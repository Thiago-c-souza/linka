import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Truck, Cpu, AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Device, Driver, Vehicle } from '../../types';
import { CreateVehicleInput, CreateVehicleResult } from '../../hooks/useFleetStore';
import { TraccarConfig } from '../../services/traccarService';

interface VehiclesManagementProps {
  vehicles: Vehicle[];
  devices: Device[];
  drivers: Driver[];
  onCreateVehicle: (input: CreateVehicleInput) => Promise<CreateVehicleResult>;
  onDeleteVehicle: (vehicleId: string) => void;
  traccarConfig: TraccarConfig;
}

interface VehicleFormState {
  plate: string;
  brand: string;
  model: string;
  year: number;
  fuelType: Vehicle['fuelType'];
  vehicleType?: Vehicle['vehicleType'];
  driverId?: string;
  registerDevice: boolean;
  imei: string;
  deviceModel: string;
  protocol: string;
  iccid: string;
  pushToTraccar: boolean;
  traccarVehicleName: string;
  traccarDeviceName: string;
}

const initialFormState: VehicleFormState = {
  plate: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  fuelType: 'diesel',
  vehicleType: 'truck',
  driverId: undefined,
  registerDevice: true,
  imei: '',
  deviceModel: '',
  protocol: 'GT06',
  iccid: '',
  pushToTraccar: false,
  traccarVehicleName: '',
  traccarDeviceName: '',
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-700',
};

const fuelLabels: Record<Vehicle['fuelType'], string> = {
  diesel: 'Diesel',
  gasoline: 'Gasolina',
  electric: 'Elétrico',
  hybrid: 'Híbrido',
};

const vehicleTypeLabels: Record<NonNullable<Vehicle['vehicleType']>, string> = {
  car: 'Carro',
  truck: 'Caminhão',
  motorcycle: 'Moto',
  machine: 'Máquina',
};

export const VehiclesManagement: React.FC<VehiclesManagementProps> = ({
  vehicles,
  devices,
  drivers,
  onCreateVehicle,
  onDeleteVehicle,
  traccarConfig,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formState, setFormState] = useState<VehicleFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!traccarConfig.baseUrl && formState.pushToTraccar) {
      setFormState(prev => ({ ...prev, pushToTraccar: false }));
    }
  }, [traccarConfig.baseUrl]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const device = vehicle.deviceId ? devices.find(d => d.id === vehicle.deviceId) : undefined;
      const driver = vehicle.driverId ? drivers.find(d => d.id === vehicle.driverId) : undefined;

      const matchesSearch = !searchTerm
        || vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase())
        || vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
        || vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())
        || driver?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || vehicle.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, devices, drivers, filterStatus, searchTerm]);

  const totalVehicles = vehicles.length;
  const vehiclesWithDevice = vehicles.filter(vehicle => Boolean(vehicle.deviceId)).length;
  const maintenanceVehicles = vehicles.filter(vehicle => vehicle.status === 'maintenance').length;
  const withoutDevice = totalVehicles - vehiclesWithDevice;

  const handleOpenModal = () => {
    setFormState(initialFormState);
    setFeedback(null);
    setShowCreateModal(true);
  };

  const handleFormChange = <K extends keyof VehicleFormState>(field: K, value: VehicleFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.plate.trim()) {
      setFeedback({ type: 'error', message: 'Informe a placa do veículo.' });
      return;
    }

    const normalizedPlate = formState.plate.trim().toUpperCase();
    if (vehicles.some(vehicle => vehicle.plate === normalizedPlate)) {
      setFeedback({ type: 'error', message: 'Já existe um veículo cadastrado com esta placa.' });
      return;
    }

    if (!formState.model.trim()) {
      setFeedback({ type: 'error', message: 'Informe o modelo do veículo.' });
      return;
    }

    if (formState.registerDevice && !formState.imei.trim()) {
      setFeedback({ type: 'error', message: 'Informe o IMEI do dispositivo a ser cadastrado.' });
      return;
    }

    if (formState.registerDevice) {
      const sanitizedImei = formState.imei.replace(/\D/g, '');
      if (devices.some(device => device.imei.replace(/\D/g, '') === sanitizedImei)) {
        setFeedback({ type: 'error', message: 'Já existe um dispositivo cadastrado com este IMEI.' });
        return;
      }
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const sanitizedImei = formState.registerDevice ? formState.imei.replace(/\D/g, '') : undefined;

      const payload: CreateVehicleInput = {
        plate: formState.plate,
        brand: formState.brand,
        model: formState.model,
        year: Number(formState.year) || new Date().getFullYear(),
        fuelType: formState.fuelType,
        vehicleType: formState.vehicleType,
        driverId: formState.driverId,
        status: 'active',
        device: formState.registerDevice
          ? {
              imei: sanitizedImei || '',
              model: formState.deviceModel || 'Dispositivo de rastreamento',
              protocol: formState.protocol,
              iccid: formState.iccid,
            }
          : null,
        pushToTraccar: formState.pushToTraccar,
        traccarDeviceName: formState.traccarDeviceName || undefined,
        traccarVehicleName: formState.traccarVehicleName || undefined,
      };

      const result = await onCreateVehicle(payload);

      let message = 'Veículo cadastrado com sucesso na plataforma.';
      if (result.traccar) {
        message += ` Integração Traccar: ${result.traccar.message}`;
      }

      setFeedback({ type: 'success', message });
      setFormState(initialFormState);
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível cadastrar o veículo. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (vehicleId: string) => {
    if (window.confirm('Deseja realmente remover este veículo?')) {
      onDeleteVehicle(vehicleId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Veículos</h2>
          <p className="text-gray-600">Cadastre novos veículos, associe dispositivos e sincronize com o Traccar.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Novo veículo
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Veículos cadastrados</p>
          <p className="text-2xl font-semibold text-gray-900">{totalVehicles}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Com dispositivo</p>
          <p className="text-2xl font-semibold text-blue-600">{vehiclesWithDevice}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Sem dispositivo</p>
          <p className="text-2xl font-semibold text-yellow-600">{withoutDevice}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Em manutenção</p>
          <p className="text-2xl font-semibold text-amber-600">{maintenanceVehicles}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por placa, modelo ou motorista"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="maintenance">Manutenção</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredVehicles.map(vehicle => {
          const device = vehicle.deviceId ? devices.find(d => d.id === vehicle.deviceId) : undefined;
          const driver = vehicle.driverId ? drivers.find(d => d.id === vehicle.driverId) : undefined;

          return (
            <div key={vehicle.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{vehicle.plate}</p>
                  <p className="text-xs text-gray-500">
                    {vehicle.brand} {vehicle.model} · {vehicle.year}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge[vehicle.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {vehicle.status === 'maintenance' ? 'Manutenção' : vehicle.status === 'inactive' ? 'Inativo' : 'Ativo'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                <div>
                  <span className="font-medium text-gray-500 block">Tipo</span>
                  <span className="text-gray-800">
                    {vehicle.vehicleType ? vehicleTypeLabels[vehicle.vehicleType] : 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Combustível</span>
                  <span className="text-gray-800">{fuelLabels[vehicle.fuelType]}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Odômetro</span>
                  <span className="text-gray-800">{vehicle.odometer.toLocaleString()} km</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Próx. revisão</span>
                  <span className="text-gray-800">{vehicle.nextMaintenance.toLocaleString()} km</span>
                </div>
              </div>

              {device ? (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800 space-y-1">
                  <div className="flex items-center gap-2 font-medium text-blue-900">
                    <Cpu size={14} /> Dispositivo vinculado
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Modelo</span>
                    <span className="font-semibold">{device.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>IMEI</span>
                    <span className="font-mono">{device.imei}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    Sem dispositivo cadastrado
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Atualização</span>
                <span>{device?.lastUpdate ? formatLastUpdate(device.lastUpdate) : 'Sem dados'}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="font-medium text-gray-900">Nenhum veículo encontrado</p>
          <p className="text-sm text-gray-600">Ajuste os filtros ou cadastre um novo veículo.</p>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cadastrar veículo</h3>
                <p className="text-sm text-gray-600">Informe os dados do veículo e, opcionalmente, registre o dispositivo.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-900"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Placa *</label>
                  <input
                    type="text"
                    value={formState.plate}
                    onChange={(event) => handleFormChange('plate', event.target.value.toUpperCase())}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ABC1D23"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Marca</label>
                  <input
                    type="text"
                    value={formState.brand}
                    onChange={(event) => handleFormChange('brand', event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Volvo"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Modelo *</label>
                  <input
                    type="text"
                    value={formState.model}
                    onChange={(event) => handleFormChange('model', event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: FH540"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Ano</label>
                  <input
                    type="number"
                    value={formState.year}
                    onChange={(event) => handleFormChange('year', Number(event.target.value))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={formState.vehicleType}
                    onChange={(event) => handleFormChange('vehicleType', event.target.value as Vehicle['vehicleType'])}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="truck">Caminhão</option>
                    <option value="car">Carro</option>
                    <option value="motorcycle">Moto</option>
                    <option value="machine">Máquina</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Combustível</label>
                  <select
                    value={formState.fuelType}
                    onChange={(event) => handleFormChange('fuelType', event.target.value as Vehicle['fuelType'])}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="gasoline">Gasolina</option>
                    <option value="electric">Elétrico</option>
                    <option value="hybrid">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Motorista responsável</label>
                  <select
                    value={formState.driverId ?? ''}
                    onChange={(event) => handleFormChange('driverId', event.target.value || undefined)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sem vinculação</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.registerDevice}
                    onChange={(event) => handleFormChange('registerDevice', event.target.checked)}
                    className="rounded text-blue-600"
                  />
                  Registrar dispositivo e vincular ao veículo
                </label>

                {formState.registerDevice && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">IMEI *</label>
                      <input
                        type="text"
                        value={formState.imei}
                        onChange={(event) => handleFormChange('imei', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Modelo do dispositivo</label>
                      <input
                        type="text"
                        value={formState.deviceModel}
                        onChange={(event) => handleFormChange('deviceModel', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Protocolo</label>
                      <input
                        type="text"
                        value={formState.protocol}
                        onChange={(event) => handleFormChange('protocol', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">ICCID (chip)</label>
                      <input
                        type="text"
                        value={formState.iccid}
                        onChange={(event) => handleFormChange('iccid', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.pushToTraccar}
                    onChange={(event) => handleFormChange('pushToTraccar', event.target.checked)}
                    className="rounded text-blue-600"
                    disabled={!traccarConfig.baseUrl}
                  />
                  Sincronizar automaticamente com o Traccar
                </label>
                {!traccarConfig.baseUrl && (
                  <p className="text-xs text-gray-500">
                    Configure a URL do Traccar em Administração → Configurações para habilitar a sincronização automática.
                  </p>
                )}

                {formState.pushToTraccar && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Nome do veículo no Traccar</label>
                      <input
                        type="text"
                        value={formState.traccarVehicleName}
                        onChange={(event) => handleFormChange('traccarVehicleName', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Frota 01 - FH540"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Nome do dispositivo no Traccar</label>
                      <input
                        type="text"
                        value={formState.traccarDeviceName}
                        onChange={(event) => handleFormChange('traccarDeviceName', event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: FH540 - IMEI"
                      />
                    </div>
                  </div>
                )}
              </div>

              {feedback && (
                <div
                  className={`border rounded-lg px-4 py-3 text-sm ${
                    feedback.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Salvar veículo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
