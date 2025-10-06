import { Device, Vehicle } from '../types';

export interface TraccarConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface NormalizedTraccarUrls {
  httpBaseUrl: string | null;
  wsBaseUrl: string | null;
}

export interface TraccarRegistrationPayload {
  vehicle: Vehicle;
  device?: Device;
  deviceAlias?: string;
  vehicleAlias?: string;
  groupId?: number;
}

export interface TraccarRegistrationResult {
  success: boolean;
  message: string;
  remoteVehicleId?: number;
  remoteDeviceId?: number;
  details?: string;
}

export interface TraccarStreamHandlers {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent<string>) => void;
  /**
   * Extra query params that should be appended when opening the socket
   * (e.g. `{ deviceId: 123 }`). Values will be coerced to strings.
   */
  queryParams?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_TIMEOUT = 8000;

const encodeBasicAuth = (username: string, password: string) => {
  if (typeof btoa !== 'function') {
    throw new Error('Função btoa indisponível para gerar autorização básica.');
  }

  return btoa(`${username}:${password}`);
};

export const normalizeBaseUrls = (rawUrl?: string): NormalizedTraccarUrls => {
  if (!rawUrl) {
    return { httpBaseUrl: null, wsBaseUrl: null };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { httpBaseUrl: null, wsBaseUrl: null };
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  const lower = withoutTrailingSlash.toLowerCase();

  if (lower.startsWith('ws://') || lower.startsWith('wss://')) {
    const httpProtocol = lower.startsWith('wss://') ? 'https://' : 'http://';
    const httpBaseUrl = httpProtocol + withoutTrailingSlash.slice(lower.indexOf('://') + 3);
    return {
      httpBaseUrl,
      wsBaseUrl: withoutTrailingSlash,
    };
  }

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const wsProtocol = lower.startsWith('https://') ? 'wss://' : 'ws://';
    const wsBaseUrl = wsProtocol + withoutTrailingSlash.slice(lower.indexOf('://') + 3);
    return {
      httpBaseUrl: withoutTrailingSlash,
      wsBaseUrl,
    };
  }

  const assumedHttp = withoutTrailingSlash.includes(':') ? `http://${withoutTrailingSlash}` : `https://${withoutTrailingSlash}`;
  const assumedWs = assumedHttp.replace(/^http/, 'ws');

  return {
    httpBaseUrl: assumedHttp,
    wsBaseUrl: assumedWs,
  };
};

export class TraccarService {
  private config: TraccarConfig;
  private httpBaseUrl: string | null;
  private wsBaseUrl: string | null;

  constructor(config: TraccarConfig) {
    this.config = config;
    const normalized = normalizeBaseUrls(config.baseUrl);
    this.httpBaseUrl = normalized.httpBaseUrl;
    this.wsBaseUrl = normalized.wsBaseUrl;
  }

  public updateConfig(config: TraccarConfig) {
    this.config = config;
    const normalized = normalizeBaseUrls(config.baseUrl);
    this.httpBaseUrl = normalized.httpBaseUrl;
    this.wsBaseUrl = normalized.wsBaseUrl;
  }

  private buildHeaders(): Headers {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');

    if (this.config.token) {
      headers.set('Authorization', `Bearer ${this.config.token}`);
    } else if (this.config.username && this.config.password) {
      headers.set('Authorization', `Basic ${encodeBasicAuth(this.config.username, this.config.password)}`);
    }

    return headers;
  }

  private ensureHttpBaseUrl(): asserts this is TraccarService & { httpBaseUrl: string } {
    if (!this.httpBaseUrl) {
      throw new Error('Configuração do Traccar incompleta. Defina a URL base nas configurações.');
    }
  }

  private buildUrl(path: string) {
    this.ensureHttpBaseUrl();
    return `${this.httpBaseUrl}${path}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.ensureHttpBaseUrl();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
      : undefined;

    try {
      const response = await fetch(this.buildUrl(path), {
        ...init,
        headers: this.buildHeaders(),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Falha na chamada ao Traccar (${response.status})`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  public async testConnection(): Promise<TraccarRegistrationResult> {
    if (!this.httpBaseUrl) {
      return {
        success: false,
        message: 'Defina a URL base do Traccar para testar a conexão.',
      };
    }

    try {
      await this.request('/api/server');
      return {
        success: true,
        message: 'Conexão com o Traccar estabelecida com sucesso.',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível conectar ao Traccar. Verifique as credenciais.',
      };
    }
  }

  public async registerVehicle(payload: TraccarRegistrationPayload): Promise<TraccarRegistrationResult> {
    if (!this.httpBaseUrl) {
      return {
        success: false,
        message: 'Configuração do Traccar não encontrada. Salve as credenciais antes de registrar.',
      };
    }

    let remoteDeviceId: number | undefined;
    let remoteVehicleId: number | undefined;

    try {
      if (payload.device) {
        const deviceResponse = await this.request<any>('/api/devices', {
          method: 'POST',
          body: JSON.stringify({
            name: payload.deviceAlias ?? `${payload.vehicle.plate} - ${payload.device.model}`,
            uniqueId: payload.device.imei,
            status: 'online',
            attributes: {
              model: payload.device.model,
              protocol: payload.device.protocol,
              vehiclePlate: payload.vehicle.plate,
            },
          }),
        });

        remoteDeviceId = deviceResponse?.id ?? deviceResponse?.deviceId;
      }

      const vehicleResponse = await this.request<any>('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.vehicleAlias ?? `${payload.vehicle.plate} - ${payload.vehicle.model}`,
          status: payload.vehicle.status,
          contact: '',
          uniqueId: payload.vehicle.id,
          attributes: {
            plate: payload.vehicle.plate,
            brand: payload.vehicle.brand,
            model: payload.vehicle.model,
            color: payload.vehicle.color,
            vehicleType: payload.vehicle.vehicleType,
          },
          groupId: payload.groupId,
        }),
      });

      remoteVehicleId = vehicleResponse?.id ?? vehicleResponse?.vehicleId;

      if (remoteVehicleId && remoteDeviceId) {
        await this.request('/api/permissions', {
          method: 'POST',
          body: JSON.stringify({
            deviceId: remoteDeviceId,
            vehicleId: remoteVehicleId,
          }),
        });
      }

      return {
        success: true,
        message: 'Veículo sincronizado com o Traccar com sucesso.',
        remoteDeviceId,
        remoteVehicleId,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Erro ao integrar veículo com o Traccar.',
        remoteDeviceId,
        remoteVehicleId,
      };
    }
  }

  public getNormalizedUrls(): NormalizedTraccarUrls {
    return {
      httpBaseUrl: this.httpBaseUrl,
      wsBaseUrl: this.wsBaseUrl,
    };
  }

  public connectToEventsStream(handlers?: TraccarStreamHandlers): WebSocket | null {
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket API indisponível no ambiente atual.');
      return null;
    }

    if (!this.wsBaseUrl) {
      console.warn('URL base do Traccar ausente. Configure antes de abrir a conexão WS.');
      return null;
    }

    const url = new URL(`${this.wsBaseUrl}/api/socket`);
    const params = new URLSearchParams();

    if (this.config.token) {
      params.set('token', this.config.token);
    } else if (this.config.username && this.config.password) {
      params.set('user', this.config.username);
      params.set('password', this.config.password);
    }

    if (handlers?.queryParams) {
      for (const [key, value] of Object.entries(handlers.queryParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
    }

    url.search = params.toString();

    const socket = new WebSocket(url.toString());

    if (handlers?.onOpen) {
      socket.addEventListener('open', handlers.onOpen);
    }
    if (handlers?.onClose) {
      socket.addEventListener('close', handlers.onClose);
    }
    if (handlers?.onError) {
      socket.addEventListener('error', handlers.onError);
    }
    if (handlers?.onMessage) {
      socket.addEventListener('message', handlers.onMessage);
    }

    return socket;
  }
}
