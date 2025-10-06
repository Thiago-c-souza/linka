import React, { useMemo, useState } from 'react';
import { Search, Plus, Truck, Clock } from 'lucide-react';
import { Device, Vehicle, Driver } from '../../types';

interface VehiclesListProps {
  devices: Device[];
  vehicles: Vehicle[];
  drivers: Driver[];
}

const statusLabels: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  inactive: 'Inativo',
  maintenance: 'Manutenção',
};

const statusBadges: Record<string, string> = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-gray-100 text-gray-800',
  inactive: 'bg-red-100 text-red-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
};

const getStatusBadge = (status: string) => statusBadges[status] ?? 'bg-gray-100 text-gray-800';

const formatLastUpdate = (timestamp?: string) => {
  if (!timestamp) {
    return 'Sem telemetria';
  }

  const now = new Date();
  const updateTime = new Date(timestamp);
  const diffMs = now.getTime() - updateTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
  return `${Math.floor(diffMins / 1440)}d atrás`;
};

export const VehiclesList: React.FC<VehiclesListProps> = ({ devices, vehicles, drivers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const device = vehicle.deviceId ? devices.find(current => current.id === vehicle.deviceId) : undefined;
      const driver = vehicle.driverId
        ? drivers.find(current => current.id === vehicle.driverId)
        : device?.driverId
          ? drivers.find(current => current.id === device.driverId)
          : undefined;

      const matchesSearch = !searchTerm
        || vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase())
        || vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
        || vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())
        || driver?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const statusToCompare = device?.status ?? vehicle.status;
      const matchesFilter = filterStatus === 'all' || statusToCompare === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [vehicles, devices, drivers, searchTerm, filterStatus]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Veículos</h1>
          <p className="text-sm sm:text-base text-gray-600">Gestão da frota e dispositivos</p>
        </div>
        <button className="flex items-center gap-1 sm:gap-2 bg-blue-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Adicionar Veículo</span>
          <span className="sm:hidden">Adicionar</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por placa, motorista ou modelo..."
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
            <option value="all">Todos os Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="inactive">Inativo</option>
            <option value="maintenance">Manutenção</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
        {filteredVehicles.map(vehicle => {
          const device = vehicle.deviceId ? devices.find(current => current.id === vehicle.deviceId) : undefined;
          const driver = vehicle.driverId
            ? drivers.find(current => current.id === vehicle.driverId)
            : device?.driverId
              ? drivers.find(current => current.id === device.driverId)
              : undefined;
          const position = device?.position;
          const status = device?.status ?? vehicle.status;

          return (
            <div key={vehicle.id} className="bg-white rounded-lg sm:rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      {vehicle.photo ? (
                        <img
                          src={vehicle.photo}
                          alt={`Foto do veículo ${vehicle.plate}`}
                          className="w-4 h-4 sm:w-5 sm:h-5 object-cover rounded"
                          onError={(event) => {
                            const target = event.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Truck className={`text-blue-600 ${vehicle.photo ? 'hidden' : ''}`} size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {vehicle.plate || 'N/A'}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        {vehicle.brand} {vehicle.model}
                      </p>
                    </div>
                  </div>
                  <span className={`px-1 sm:px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${getStatusBadge(status)}`}>
                    {device ? statusLabels[status] ?? status : 'Sem dispositivo'}
                  </span>
                </div>

                {driver && (
                  <div className="mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{driver.name}</p>
                    <p className="text-xs text-gray-600">CNH: {driver.license}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-16 sm:w-20 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${driver.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{driver.score}%</span>
                    </div>
                  </div>
                )}

                {device && (
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                    <div>
                      <span className="font-medium text-gray-500 block">Dispositivo</span>
                      <span className="text-gray-800">{device.model}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500 block">IMEI</span>
                      <span className="text-gray-800">{device.imei}</span>
                    </div>
                  </div>
                )}

                {position && (
                  <div className="space-y-2 sm:space-y-3 mt-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Velocidade:</span>
                      <span className="font-medium">{position.speed} km/h</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Odômetro:</span>
                      <span className="font-medium">{position.odometer.toLocaleString()} km</span>
                    </div>
                    {position.fuel !== undefined && (
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-600">Combustível:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 sm:w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${position.fuel}%` }}
                            />
                          </div>
                          <span className="font-medium">{position.fuel}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={12} />
                    <span className="truncate">{formatLastUpdate(device?.lastUpdate)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-12 text-center">
          <Truck className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-2 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Nenhum veículo encontrado</h3>
          <p className="text-sm sm:text-base text-gray-600">Tente ajustar os filtros ou adicionar novos veículos.</p>
        </div>
      )}
    </div>
  );
};
