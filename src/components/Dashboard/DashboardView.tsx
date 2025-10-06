import React, { useState } from 'react';
import { StatsCard } from './StatsCard';
import { FleetMap } from './FleetMap';
import { RecentAlerts } from './RecentAlerts';
import { Truck, Users, AlertTriangle, TrendingUp, Fuel, Clock, Wrench } from 'lucide-react';
import { Device, Alert, Vehicle, Driver, MapConfiguration } from '../../types';

interface DashboardViewProps {
  devices: Device[];
  alerts: Alert[];
  vehicles?: Vehicle[];
  drivers: Driver[];
  mapConfig: MapConfiguration;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ devices, alerts, vehicles = [], drivers, mapConfig }) => {
  const [selectedDevice, setSelectedDevice] = useState<string>();

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const movingDevices = devices.filter(d => d.position?.ignition && d.position?.speed > 5).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const avgScore = drivers.length
    ? Math.round(drivers.reduce((acc, driver) => acc + driver.score, 0) / drivers.length)
    : 0;
  const maintenanceVehicles = vehicles.filter(vehicle => vehicle.status === 'maintenance').length;
  const maintenanceWindowVehicles = vehicles.filter(vehicle => vehicle.nextMaintenance - vehicle.odometer <= 2000).length;
  const totalFleetOdometer = vehicles.reduce((accumulator, vehicle) => accumulator + vehicle.odometer, 0);
  const devicesReportingFuel = devices.filter(device => device.position?.fuel !== undefined);
  const avgFuelLevel = devicesReportingFuel.length
    ? Math.round(
        devicesReportingFuel.reduce((accumulator, device) => accumulator + (device.position?.fuel ?? 0), 0) /
          devicesReportingFuel.length,
      )
    : null;
  const alertsToday = alerts.filter(alert => new Date(alert.timestamp).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard da Frota</h1>
        <p className="text-sm sm:text-base text-gray-600">Visão geral das operações em tempo real</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatsCard
          title="Veículos Online"
          value={`${onlineDevices}/${devices.length}`}
          subtitle="Dispositivos conectados"
          icon={Truck}
          trend={{ value: 5, isPositive: true }}
          color="blue"
        />
        <StatsCard
          title="Em Movimento"
          value={movingDevices}
          subtitle="Veículos ativos"
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Alertas Críticos"
          value={criticalAlerts}
          subtitle={`${alertsToday} gerados hoje`}
          icon={AlertTriangle}
          trend={{ value: -12, isPositive: true }}
          color={criticalAlerts > 0 ? "red" : "green"}
        />
        <StatsCard
          title="Score Médio"
          value={`${avgScore}%`}
          subtitle="Comportamento de condução"
          icon={Users}
          trend={{ value: 3, isPositive: true }}
          color="green"
        />
        <StatsCard
          title="Em manutenção"
          value={maintenanceVehicles}
          subtitle="Veículos fora de operação"
          icon={Wrench}
          color={maintenanceVehicles > 0 ? 'yellow' : 'green'}
        />
      </div>

      {/* Map and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <FleetMap
            devices={devices}
            vehicles={vehicles}
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            mapConfig={mapConfig}
          />
        </div>
        <div>
          <RecentAlerts alerts={alerts.slice(0, 10)} />
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <StatsCard
          title="Nível médio de combustível"
          value={avgFuelLevel !== null ? `${avgFuelLevel}%` : 'N/A'}
          subtitle="Veículos com telemetria ativa"
          icon={Fuel}
          color={avgFuelLevel !== null ? 'blue' : 'gray'}
        />
        <StatsCard
          title="Próximas manutenções"
          value={maintenanceWindowVehicles}
          subtitle="A menos de 2.000 km da revisão"
          icon={Clock}
          color={maintenanceWindowVehicles > 0 ? 'yellow' : 'green'}
        />
        <StatsCard
          title="Quilometragem acumulada"
          value={`${totalFleetOdometer.toLocaleString()} km`}
          subtitle="Somatório do odômetro da frota"
          icon={TrendingUp}
          color="blue"
        />
      </div>
    </div>
  );
};