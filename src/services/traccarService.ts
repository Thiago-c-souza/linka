import { Device, Vehicle } from '../types';

export interface TraccarConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
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

const DEFAULT_TIMEOUT = 8000;

const encodeBasicAuth = (username: string, password: string) => {
  if (typeof btoa !== 'function') {
    throw new Error('Função btoa indisponível para gerar autorização básica.');
  }

  return btoa(`${username}:${password}`);
};

export class TraccarService {
  private config: TraccarConfig;

  constructor(config: TraccarConfig) {
    this.config = config;
  }

  public updateConfig(config: TraccarConfig) {
    this.config = config;
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

  private buildUrl(path: string) {
    const baseUrl = this.config.baseUrl?.replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.config.baseUrl) {
      throw new Error('Configuração do Traccar incompleta. Defina a URL base nas configurações.');
    }

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
    if (!this.config.baseUrl) {
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
    if (!this.config.baseUrl) {
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
}
