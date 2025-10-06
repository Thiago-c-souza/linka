import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Device,
  Driver,
  Geofence,
  MapConfiguration,
  Trip,
  Vehicle,
} from '../types';
import {
  defaultMapConfig,
  mockAlerts,
  mockDevices,
  mockDrivers,
  mockGeofences,
  mockTrips,
  mockVehicles,
} from '../data/mockData';
import {
  NormalizedTraccarUrls,
  TraccarConfig,
  TraccarRegistrationResult,
  TraccarService,
  TraccarStreamHandlers,
} from '../services/traccarService';

export interface CreateVehicleDeviceInput {
  imei: string;
  model: string;
  protocol?: string;
  iccid?: string;
}

export interface CreateVehicleInput {
  plate: string;
  model: string;
  brand: string;
  year: number;
  fuelType: Vehicle['fuelType'];
  vehicleType?: Vehicle['vehicleType'];
  tenantId?: string;
  clientId?: string;
  driverId?: string;
  status?: Vehicle['status'];
  odometer?: number;
  nextMaintenance?: number;
  color?: string;
  chassisNumber?: string;
  photo?: string;
  device?: CreateVehicleDeviceInput | null;
  pushToTraccar?: boolean;
  traccarDeviceName?: string;
  traccarVehicleName?: string;
  traccarGroupId?: number;
}

export interface CreateVehicleResult {
  vehicle: Vehicle;
  device?: Device;
  traccar?: TraccarRegistrationResult;
}

export interface FleetStore {
  vehicles: Vehicle[];
  devices: Device[];
  drivers: Driver[];
  alerts: Alert[];
  trips: Trip[];
  geofences: Geofence[];
  mapConfig: MapConfiguration;
  traccarConfig: TraccarConfig;
  acknowledgeAlert: (alertId: string, acknowledgedBy: string) => void;
  addAlert: (alert: Alert) => void;
  createVehicle: (input: CreateVehicleInput) => Promise<CreateVehicleResult>;
  updateVehicle: (vehicleId: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (vehicleId: string) => void;
  saveMapApiKey: (apiKey: string) => void;
  clearMapApiKey: () => void;
  updateMapSettings: (settings: Partial<MapConfiguration['settings']>) => void;
  setMapProvider: (provider: MapConfiguration['provider']) => void;
  updateTraccarConfig: (config: Partial<TraccarConfig>) => void;
  testTraccarConnection: () => Promise<TraccarRegistrationResult>;
  openTraccarStream: (handlers?: TraccarStreamHandlers) => WebSocket | null;
  getTraccarBaseUrls: () => NormalizedTraccarUrls;
  pendingAlerts: number;
}

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}`;
};

const loadFromStorage = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}"`, error);
    return null;
  }
};

const persistToStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist key "${key}" to localStorage`, error);
  }
};

export const useFleetStore = (): FleetStore => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [drivers] = useState<Driver[]>(mockDrivers);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [trips] = useState<Trip[]>(mockTrips);
  const [geofences] = useState<Geofence[]>(mockGeofences);

  const persistedMapConfig = useMemo(() => loadFromStorage<MapConfiguration>('mapConfig'), []);
  const persistedMapsKey = useMemo(() => {
    if (persistedMapConfig?.apiKey) {
      return persistedMapConfig.apiKey;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }
    return window.localStorage.getItem('googleMapsApiKey') ?? undefined;
  }, [persistedMapConfig]);

  const [mapConfig, setMapConfig] = useState<MapConfiguration>({
    ...defaultMapConfig,
    ...(persistedMapConfig ?? {}),
    apiKey: persistedMapConfig?.apiKey ?? persistedMapsKey,
  });

  const [traccarConfig, setTraccarConfig] = useState<TraccarConfig>(() => {
    const stored = loadFromStorage<TraccarConfig>('traccarConfig');
    return stored ?? { baseUrl: '', username: '', password: '' };
  });

  useEffect(() => {
    persistToStorage('mapConfig', mapConfig);
    if (mapConfig.apiKey) {
      persistToStorage('googleMapsApiKey', mapConfig.apiKey);
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem('googleMapsApiKey');
    }
  }, [mapConfig]);

  useEffect(() => {
    persistToStorage('traccarConfig', traccarConfig);
  }, [traccarConfig]);

  const traccarService = useMemo(() => new TraccarService(traccarConfig), [traccarConfig]);

  const acknowledgeAlert = useCallback((alertId: string, acknowledgedBy: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? {
              ...alert,
              acknowledged: true,
              acknowledgedBy,
              acknowledgedAt: new Date().toISOString(),
            }
          : alert,
      ),
    );
  }, []);

  const addAlert = useCallback((alert: Alert) => {
    setAlerts(prev => [alert, ...prev]);
  }, []);

  const createVehicle = useCallback(
    async (input: CreateVehicleInput): Promise<CreateVehicleResult> => {
      const tenantId = input.tenantId ?? 't_001';
      const normalizedPlate = input.plate.trim().toUpperCase();

      if (vehicles.some(vehicle => vehicle.plate === normalizedPlate)) {
        throw new Error('Já existe um veículo cadastrado com esta placa.');
      }

      const sanitizedImei = input.device?.imei ? input.device.imei.replace(/\D/g, '') : undefined;
      if (sanitizedImei && devices.some(device => device.imei.replace(/\D/g, '') === sanitizedImei)) {
        throw new Error('Já existe um dispositivo com este IMEI cadastrado.');
      }

      const vehicleId = generateId('veh');
      const deviceId = input.device ? generateId('dev') : undefined;

      const newVehicle: Vehicle = {
        id: vehicleId,
        tenantId,
        plate: normalizedPlate,
        model: input.model,
        brand: input.brand,
        year: input.year,
        fuelType: input.fuelType,
        deviceId,
        driverId: input.driverId,
        status: input.status ?? 'active',
        odometer: input.odometer ?? 0,
        nextMaintenance: input.nextMaintenance ?? 0,
        photo: input.photo,
        vehicleType: input.vehicleType,
        clientId: input.clientId,
        color: input.color,
        chassisNumber: input.chassisNumber,
      };

      let newDevice: Device | undefined;
      if (input.device) {
        newDevice = {
          id: deviceId!,
          tenantId,
          imei: sanitizedImei!,
          iccid: input.device.iccid ?? '',
          model: input.device.model,
          protocol: input.device.protocol ?? 'GT06',
          driverId: input.driverId,
          vehicleId,
          status: 'inactive',
          lastUpdate: new Date().toISOString(),
        };
      }

      setVehicles(prev => [...prev, newVehicle]);
      if (newDevice) {
        setDevices(prev => [...prev, newDevice!]);
      }

      let traccar: TraccarRegistrationResult | undefined;

      if (input.pushToTraccar) {
        try {
          traccar = await traccarService.registerVehicle({
            vehicle: newVehicle,
            device: newDevice,
            deviceAlias: input.traccarDeviceName,
            vehicleAlias: input.traccarVehicleName,
            groupId: input.traccarGroupId,
          });
        } catch (error) {
          traccar = {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'Não foi possível comunicar com o Traccar. Verifique a configuração.',
          };
        }
      }

      return {
        vehicle: newVehicle,
        device: newDevice,
        traccar,
      };
    },
    [devices, traccarService, vehicles],
  );

  const updateVehicle = useCallback((vehicleId: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(vehicle => (vehicle.id === vehicleId ? { ...vehicle, ...updates } : vehicle)));
  }, []);

  const deleteVehicle = useCallback((vehicleId: string) => {
    setVehicles(prev => prev.filter(vehicle => vehicle.id !== vehicleId));
    setDevices(prev =>
      prev.map(device =>
        device.vehicleId === vehicleId
          ? {
              ...device,
              vehicleId: undefined,
              status: 'inactive',
            }
          : device,
      ),
    );
  }, []);

  const saveMapApiKey = useCallback((apiKey: string) => {
    setMapConfig(prev => ({
      ...prev,
      apiKey: apiKey.trim(),
    }));
  }, []);

  const clearMapApiKey = useCallback(() => {
    setMapConfig(prev => ({
      ...prev,
      apiKey: undefined,
    }));
  }, []);

  const updateMapSettings = useCallback((settings: Partial<MapConfiguration['settings']>) => {
    setMapConfig(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settings,
      },
    }));
  }, []);

  const setMapProvider = useCallback((provider: MapConfiguration['provider']) => {
    setMapConfig(prev => ({
      ...prev,
      provider,
    }));
  }, []);

  const updateTraccarConfig = useCallback((config: Partial<TraccarConfig>) => {
    setTraccarConfig(prev => ({ ...prev, ...config }));
  }, []);

  const testTraccarConnection = useCallback(async () => {
    try {
      return await traccarService.testConnection();
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao testar integração com Traccar.',
      } as TraccarRegistrationResult;
    }
  }, [traccarService]);

  const openTraccarStream = useCallback(
    (handlers?: TraccarStreamHandlers) => traccarService.connectToEventsStream(handlers),
    [traccarService],
  );

  const getTraccarBaseUrls = useCallback(
    (): NormalizedTraccarUrls => traccarService.getNormalizedUrls(),
    [traccarService],
  );

  const pendingAlerts = useMemo(() => alerts.filter(alert => !alert.acknowledged).length, [alerts]);

  return {
    vehicles,
    devices,
    drivers,
    alerts,
    trips,
    geofences,
    mapConfig,
    traccarConfig,
    acknowledgeAlert,
    addAlert,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    saveMapApiKey,
    clearMapApiKey,
    updateMapSettings,
    setMapProvider,
    updateTraccarConfig,
    testTraccarConnection,
    openTraccarStream,
    getTraccarBaseUrls,
    pendingAlerts,
  };
};
