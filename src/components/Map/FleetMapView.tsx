import React from 'react';
import { GoogleMapsIntegration } from './GoogleMapsIntegration';
import { Device, Driver, Vehicle, MapConfiguration, Geofence } from '../../types';
import { Settings, AlertCircle } from 'lucide-react';

interface FleetMapViewProps {
  devices: Device[];
  drivers: Driver[];
  vehicles: Vehicle[];
  mapConfig: MapConfiguration;
  geofences: Geofence[];
  onNavigateToAdmin?: () => void;
}

export const FleetMapView: React.FC<FleetMapViewProps> = ({
  devices,
  drivers,
  vehicles,
  mapConfig,
  geofences,
  onNavigateToAdmin
}) => {
  const shouldUseGoogle = mapConfig.provider === 'google';
  const googleMapsApiKey = mapConfig.apiKey;

  if (shouldUseGoogle && !googleMapsApiKey) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa da Frota</h1>
            <p className="text-gray-600">Visualização em tempo real da localização dos veículos</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="p-4 bg-yellow-100 rounded-lg mb-6">
              <Settings className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configuração Necessária
              </h3>
              <p className="text-sm text-gray-600">
                Para usar o mapa interativo, é necessário configurar a API do Google Maps.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                <div className="text-left">
                  <p className="text-sm text-blue-700">
                    <strong>Importante:</strong> A configuração da API do Google Maps deve ser feita na seção de
                    Administração → Configurações → Mapas selecionando o provedor “Google Maps”.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                // Navigate to admin settings
                if (onNavigateToAdmin) {
                  onNavigateToAdmin();
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ir para Configurações
            </button>

            <div className="text-left bg-gray-50 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-gray-900 mb-2">Passos para configurar:</h4>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Vá em Administração → Configurações</li>
                <li>Clique na aba "Mapas"</li>
                <li>Insira sua chave da API do Google Maps</li>
                <li>Teste e salve a configuração</li>
                <li>Retorne ao mapa para usar a funcionalidade</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!shouldUseGoogle) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa da Frota</h1>
            <p className="text-gray-600">Visualização baseada em {mapConfig.provider === 'openstreetmap' ? 'OpenStreetMap' : 'Mapbox'}.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-blue-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Visualização simplificada</h3>
            <p className="text-sm text-gray-600">
              No momento a visualização interativa está disponível apenas com Google Maps configurado.
              Selecione o provedor Google Maps para acessar controles avançados, camada de tráfego e telemetria detalhada.
            </p>
            <button
              onClick={onNavigateToAdmin}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Abrir configurações de mapas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GoogleMapsIntegration
      apiKey={googleMapsApiKey}
      devices={devices}
      vehicles={vehicles}
      settings={mapConfig.settings}
      geofences={geofences}
    />
  );
};