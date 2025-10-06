import React, { useState } from 'react';
import {
  Building,
  Truck,
  Smartphone,
  Users,
  Shield,
  BarChart3,
  Settings as SettingsIcon,
  UserPlus
} from 'lucide-react';
import { ClientsManagement } from './ClientsManagement';
import { VehiclesManagement } from './VehiclesManagement';
import { DevicesManagement } from './DevicesManagement';
import { DriversManagement } from './DriversManagement';
import { RolesManagement } from './RolesManagement';
import { AdminReports } from './AdminReports';
import { EquipmentRegistration } from '../Equipment/EquipmentRegistration';
import { AdminSettings } from './AdminSettings';
import { UserHierarchyManager } from './UserHierarchyManager';
import { AuthUser, SessionUser } from '../../types/auth';
import { FleetStore } from '../../hooks/useFleetStore';

interface AdminViewProps {
  currentUser: SessionUser;
  users: AuthUser[];
  onUsersChange: (users: AuthUser[]) => void;
  fleet: FleetStore;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, users, onUsersChange, fleet }) => {
  const [activeTab, setActiveTab] = useState('clients');

  const tabs = [
    { id: 'clients', label: 'Clientes', icon: Building },
    { id: 'userHierarchy', label: 'Usuários & Hierarquia', icon: UserPlus },
    { id: 'equipment', label: 'Equipamentos', icon: Smartphone },
    { id: 'vehicles', label: 'Veículos', icon: Truck },
    { id: 'devices', label: 'Dispositivos', icon: Smartphone },
    { id: 'drivers', label: 'Motoristas', icon: Users },
    { id: 'roles', label: 'Perfis & Permissões', icon: Shield },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'clients':
        return <ClientsManagement />;
      case 'userHierarchy':
        return (
          <UserHierarchyManager
            currentUser={currentUser}
            users={users}
            onUsersChange={onUsersChange}
          />
        );
      case 'equipment':
        return <EquipmentRegistration />;
      case 'vehicles':
        return (
          <VehiclesManagement
            vehicles={fleet.vehicles}
            devices={fleet.devices}
            drivers={fleet.drivers}
            onCreateVehicle={fleet.createVehicle}
            onDeleteVehicle={fleet.deleteVehicle}
            traccarConfig={fleet.traccarConfig}
          />
        );
      case 'devices':
        return <DevicesManagement />;
      case 'drivers':
        return <DriversManagement />;
      case 'roles':
        return <RolesManagement />;
      case 'reports':
        return <AdminReports />;
      case 'settings':
        return (
          <AdminSettings
            mapConfig={fleet.mapConfig}
            onSaveMapKey={fleet.saveMapApiKey}
            onClearMapKey={fleet.clearMapApiKey}
            onUpdateMapSettings={fleet.updateMapSettings}
            onSetMapProvider={fleet.setMapProvider}
            traccarConfig={fleet.traccarConfig}
            onUpdateTraccarConfig={fleet.updateTraccarConfig}
            onTestTraccarConnection={fleet.testTraccarConnection}
            onOpenTraccarStream={fleet.openTraccarStream}
          />
        );
      default:
        return <ClientsManagement />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Administração</h1>
        <p className="text-sm sm:text-base text-gray-600">Gestão completa da plataforma e entidades</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};