
import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { VehiclesList } from './components/Vehicles/VehiclesList';
import { DriversView } from './components/Drivers/DriversView';
import { GeofencesView } from './components/Geofences/GeofencesView';
import { AlertsView } from './components/Alerts/AlertsView';
import { TripsView } from './components/Trips/TripsView';
import { SettingsView } from './components/Settings/SettingsView';
import { AdminView } from './components/Admin/AdminView';
import { FleetMapView } from './components/Map/FleetMapView';
import { LoginView } from './components/Auth/LoginView';
import { mockAuthUsers } from './data/authUsers';
import { AuthRole, AuthUser, LoginCredentials, SessionUser } from './types/auth';
import { useFleetStore } from './hooks/useFleetStore';

const viewPermissions: Record<AuthRole, string[]> = {
  super_admin: ['dashboard', 'map', 'vehicles', 'drivers', 'geofences', 'alerts', 'trips', 'admin', 'settings'],
  master_admin: ['dashboard', 'map', 'vehicles', 'drivers', 'geofences', 'alerts', 'trips', 'admin', 'settings'],
  child_user: ['dashboard', 'map', 'vehicles', 'drivers', 'geofences', 'alerts', 'trips', 'settings'],
};

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>(mockAuthUsers);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const fleet = useFleetStore();

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // In a real implementation, this would be WebSocket connections
      console.log('Real-time data update simulation');
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const allowedViews = viewPermissions[currentUser.role];
    if (!allowedViews.includes(activeView)) {
      setActiveView(allowedViews[0]);
    }
  }, [currentUser, activeView]);

  const handleLogin = ({ email, password }: LoginCredentials) => {
    const normalizedEmail = email.trim().toLowerCase();
    const matchingUser = authUsers.find(
      user => user.email.toLowerCase() === normalizedEmail && user.password === password,
    );

    if (!matchingUser) {
      setLoginError('E-mail ou senha inválidos. Verifique as credenciais e tente novamente.');
      return;
    }

    const { password: authPassword, ...sessionUser } = matchingUser;
    void authPassword;
    setCurrentUser(sessionUser);
    setLoginError(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('dashboard');
    setIsCollapsed(false);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    if (!currentUser) {
      return;
    }

    fleet.acknowledgeAlert(alertId, currentUser.name);
  };

  const renderView = () => {
    if (!currentUser) {
      return null;
    }

    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardView
            devices={fleet.devices}
            alerts={fleet.alerts}
            vehicles={fleet.vehicles}
            drivers={fleet.drivers}
            mapConfig={fleet.mapConfig}
          />
        );
      case 'map':
        return (
          <FleetMapView
            devices={fleet.devices}
            drivers={fleet.drivers}
            vehicles={fleet.vehicles}
            mapConfig={fleet.mapConfig}
            geofences={fleet.geofences}
            onNavigateToAdmin={() => {
              if (viewPermissions[currentUser.role].includes('admin')) {
                setActiveView('admin');
              }
            }}
          />
        );
      case 'vehicles':
        return (
          <VehiclesList
            devices={fleet.devices}
            vehicles={fleet.vehicles}
            drivers={fleet.drivers}
          />
        );
      case 'drivers':
        return <DriversView drivers={fleet.drivers} devices={fleet.devices} />;
      case 'geofences':
        return <GeofencesView geofences={fleet.geofences} />;
      case 'alerts':
        return <AlertsView alerts={fleet.alerts} onAcknowledgeAlert={handleAcknowledgeAlert} />;
      case 'trips':
        return <TripsView trips={fleet.trips} drivers={fleet.drivers} vehicles={fleet.vehicles} />;
      case 'admin':
        if (currentUser.role === 'child_user') {
          return (
            <div className="bg-white border border-red-200 text-red-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
              <p className="text-sm">
                Apenas o admin geral e usuários mestres podem acessar a área administrativa completa.
              </p>
            </div>
          );
        }

        return (
          <AdminView
            currentUser={currentUser}
            users={authUsers}
            onUsersChange={setAuthUsers}
            fleet={fleet}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <DashboardView
            devices={fleet.devices}
            alerts={fleet.alerts}
            vehicles={fleet.vehicles}
            drivers={fleet.drivers}
            mapConfig={fleet.mapConfig}
          />
        );
    }
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} error={loginError} users={authUsers} />;
  }

  const allowedViews = viewPermissions[currentUser.role];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        allowedViews={allowedViews}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header user={currentUser} alertCount={fleet.pendingAlerts} onLogout={handleLogout} />

        <main className="flex-1 p-3 sm:p-6 overflow-auto">{renderView()}</main>
      </div>
    </div>
  );
}

export default App;
