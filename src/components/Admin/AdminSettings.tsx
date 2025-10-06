import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Key,
  Map,
  AlertCircle,
  CheckCircle,
  Settings as SettingsIcon,
  Globe,
  Bell,
  Wifi,
  Loader as LoaderIcon
} from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapConfiguration } from '../../types';
import {
  normalizeBaseUrls,
  TraccarConfig,
  TraccarRegistrationResult,
  TraccarStreamHandlers,
} from '../../services/traccarService';

interface AdminSettingsProps {
  mapConfig: MapConfiguration;
  onSaveMapKey: (apiKey: string) => void;
  onClearMapKey: () => void;
  onUpdateMapSettings: (settings: Partial<MapConfiguration['settings']>) => void;
  onSetMapProvider: (provider: MapConfiguration['provider']) => void;
  traccarConfig: TraccarConfig;
  onUpdateTraccarConfig: (config: Partial<TraccarConfig>) => void;
  onTestTraccarConnection: () => Promise<TraccarRegistrationResult>;
  onOpenTraccarStream?: (handlers?: TraccarStreamHandlers) => WebSocket | null;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  mapConfig,
  onSaveMapKey,
  onClearMapKey,
  onUpdateMapSettings,
  onSetMapProvider,
  traccarConfig,
  onUpdateTraccarConfig,
  onTestTraccarConnection,
  onOpenTraccarStream,
}) => {
  const [activeTab, setActiveTab] = useState<'maps' | 'system' | 'notifications' | 'integrations'>('maps');
  const [tempApiKey, setTempApiKey] = useState(mapConfig.apiKey ?? '');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingTraccar, setIsTestingTraccar] = useState(false);
  const [traccarResult, setTraccarResult] = useState<TraccarRegistrationResult | null>(null);
  const [wsTestStatus, setWsTestStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [wsTestMessage, setWsTestMessage] = useState<string | null>(null);
  const wsTestRef = useRef<WebSocket | null>(null);

  const normalizedTraccarUrls = useMemo(
    () => normalizeBaseUrls(traccarConfig.baseUrl),
    [traccarConfig.baseUrl],
  );

  useEffect(() => {
    return () => {
      wsTestRef.current?.close();
      wsTestRef.current = null;
    };
  }, []);

  useEffect(() => {
    setTempApiKey(mapConfig.apiKey ?? '');
  }, [mapConfig.apiKey]);

  const tabs = useMemo(
    () => [
      { id: 'maps', label: 'Mapas', icon: Map },
      { id: 'system', label: 'Sistema', icon: SettingsIcon },
      { id: 'notifications', label: 'Notificações', icon: Bell },
      { id: 'integrations', label: 'Integrações', icon: Globe },
    ] as const,
    [],
  );

  const testGoogleMapsAPI = async (testApiKey: string) => {
    if (!testApiKey.trim()) {
      setApiTestResult({ success: false, message: 'Informe uma chave da API para testar.' });
      return false;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const loader = new Loader({
        apiKey: testApiKey,
        version: 'weekly',
        libraries: ['maps', 'marker'],
      });

      await loader.load();
      setApiTestResult({ success: true, message: 'Chave válida! O Google Maps respondeu corretamente.' });
      return true;
    } catch (error) {
      let message = 'Erro ao validar chave do Google Maps.';
      if (error instanceof Error) {
        if (error.message.includes('InvalidKeyMapError')) {
          message = 'Chave inválida. Verifique se a chave está correta e ativa no Google Cloud.';
        } else if (error.message.includes('RequestDeniedMapError')) {
          message = 'Solicitação negada. Habilite a Maps JavaScript API e o faturamento no Google Cloud.';
        } else if (error.message.includes('RefererNotAllowedMapError')) {
          message = 'Domínio não autorizado. Ajuste as restrições da chave para incluir este domínio.';
        }
      }
      setApiTestResult({ success: false, message });
      return false;
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSaveApiKey = async () => {
    const isValid = await testGoogleMapsAPI(tempApiKey);
    if (isValid) {
      onSaveMapKey(tempApiKey.trim());
    }
  };

  const handleTestApi = () => {
    testGoogleMapsAPI(tempApiKey);
  };

  const handleTraccarTest = async () => {
    setIsTestingTraccar(true);
    const result = await onTestTraccarConnection();
    setTraccarResult(result);
    setIsTestingTraccar(false);
  };

  const handleRealtimeTest = () => {
    if (!traccarConfig.baseUrl) {
      setWsTestStatus('error');
      setWsTestMessage('Informe a URL do servidor Traccar antes de testar o streaming.');
      return;
    }

    if (!onOpenTraccarStream) {
      setWsTestStatus('error');
      setWsTestMessage('Teste de streaming indisponível neste ambiente.');
      return;
    }

    wsTestRef.current?.close();
    wsTestRef.current = null;

    setWsTestStatus('connecting');
    setWsTestMessage('Abrindo conexão em tempo real com o Traccar...');

    const socket = onOpenTraccarStream({
      queryParams: { limit: 1 },
      onOpen: () => {
        setWsTestStatus('success');
        setWsTestMessage('Conexão em tempo real estabelecida com sucesso.');
        if (wsTestRef.current) {
          wsTestRef.current.close();
          wsTestRef.current = null;
        }
      },
      onMessage: event => {
        if (typeof event.data !== 'string') {
          return;
        }

        try {
          const payload = JSON.parse(event.data);
          if (payload && typeof payload.type === 'string') {
            setWsTestMessage(`Evento recebido: ${payload.type}`);
          }
        } catch (error) {
          console.warn('Não foi possível interpretar o evento do Traccar.', error);
        }
      },
      onError: () => {
        setWsTestStatus('error');
        setWsTestMessage('Falha ao abrir a conexão WebSocket. Verifique host, porta e credenciais.');
      },
      onClose: event => {
        if (event.code === 1000) {
          return;
        }

        setWsTestStatus(prevStatus => {
          if (prevStatus === 'connecting') {
            setWsTestMessage('Conexão WebSocket encerrada antes de completar o handshake.');
            return 'error';
          }

          return prevStatus;
        });
      },
    });

    if (!socket) {
      setWsTestStatus('error');
      setWsTestMessage('Navegador sem suporte a WebSocket ou configuração ausente.');
      return;
    }

    wsTestRef.current = socket;
  };

  const handleProviderChange = (provider: MapConfiguration['provider']) => {
    if (provider === mapConfig.provider) {
      return;
    }

    if (provider === 'openstreetmap' && mapConfig.apiKey) {
      const shouldClear = typeof window !== 'undefined'
        ? window.confirm(
            'Deseja manter a chave do Google Maps salva para uso futuro? Se escolher não, ela será removida.',
          )
        : false;

      if (!shouldClear) {
        onClearMapKey();
        setTempApiKey('');
      }
    }

    onSetMapProvider(provider);
  };

  const renderMapsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuração dos mapas</h3>
        <p className="text-sm text-gray-600">Selecione o provedor e configure a chave da API do Google Maps quando necessário.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="radio"
              name="map-provider"
              value="openstreetmap"
              checked={mapConfig.provider === 'openstreetmap'}
              onChange={() => handleProviderChange('openstreetmap')}
            />
            OpenStreetMap (padrão gratuito)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="radio"
              name="map-provider"
              value="google"
              checked={mapConfig.provider === 'google'}
              onChange={() => handleProviderChange('google')}
            />
            Google Maps (requer chave)
          </label>
        </div>

        {mapConfig.provider === 'google' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Key className="text-blue-600 mt-0.5" size={18} />
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chave da API do Google Maps</label>
                  <input
                    type="text"
                    value={tempApiKey}
                    onChange={(event) => setTempApiKey(event.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {apiTestResult && (
                  <div
                    className={`border rounded-lg p-3 flex items-center gap-2 ${
                      apiTestResult.success
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-600'
                    }`}
                  >
                    {apiTestResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm">{apiTestResult.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestApi}
                    disabled={isTestingApi || !tempApiKey.trim()}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingApi ? 'Testando...' : 'Testar chave'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    disabled={isTestingApi || !tempApiKey.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Salvar chave
                  </button>
                  {mapConfig.apiKey && (
                    <button
                      type="button"
                      onClick={onClearMapKey}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900"
                    >
                      Remover chave
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={mapConfig.settings.enableTraffic}
              onChange={(event) => onUpdateMapSettings({ enableTraffic: event.target.checked })}
              className="rounded text-blue-600"
            />
            Mostrar camada de tráfego
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={mapConfig.settings.enableSatellite}
              onChange={(event) => onUpdateMapSettings({ enableSatellite: event.target.checked })}
              className="rounded text-blue-600"
            />
            Habilitar visão satélite
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={mapConfig.settings.enableTerrain}
              onChange={(event) => onUpdateMapSettings({ enableTerrain: event.target.checked })}
              className="rounded text-blue-600"
            />
            Relevo do terreno
          </label>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Integração Traccar</h3>
        <p className="text-sm text-gray-600">Configure a URL e credenciais do servidor Traccar para sincronizar veículos.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600">URL base do Traccar</label>
          <input
            type="text"
            value={traccarConfig.baseUrl}
            onChange={(event) => onUpdateTraccarConfig({ baseUrl: event.target.value })}
            placeholder="https://seu-servidor-traccar/api ou ws://seu-servidor:8082"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {traccarConfig.baseUrl && (
            <p className="mt-1 text-xs text-gray-500">
              Requisições REST usarão
              {' '}
              <code className="font-mono">{normalizedTraccarUrls.httpBaseUrl ?? '—'}</code>
              {' '}e eventos em tempo real usarão
              {' '}
              <code className="font-mono">{normalizedTraccarUrls.wsBaseUrl ?? '—'}</code>
              .
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Usuário</label>
            <input
              type="text"
              value={traccarConfig.username ?? ''}
              onChange={(event) => onUpdateTraccarConfig({ username: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Senha</label>
            <input
              type="password"
              value={traccarConfig.password ?? ''}
              onChange={(event) => onUpdateTraccarConfig({ password: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Token (opcional)</label>
            <input
              type="text"
              value={traccarConfig.token ?? ''}
              onChange={(event) => onUpdateTraccarConfig({ token: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTraccarTest}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={isTestingTraccar || !traccarConfig.baseUrl}
          >
            {isTestingTraccar ? <LoaderIcon size={16} className="animate-spin" /> : <Wifi size={16} />}
            Testar conexão
          </button>
          <button
            type="button"
            onClick={handleRealtimeTest}
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
            disabled={wsTestStatus === 'connecting'}
          >
            {wsTestStatus === 'connecting' ? <LoaderIcon size={16} className="animate-spin" /> : <Wifi size={16} />}
            Streaming em tempo real
          </button>
          {traccarResult && (
            <span className={`text-sm ${traccarResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {traccarResult.message}
            </span>
          )}
        </div>
        {wsTestMessage && (
          <div
            className={`text-xs mt-2 ${
              wsTestStatus === 'success'
                ? 'text-green-600'
                : wsTestStatus === 'error'
                  ? 'text-red-600'
                  : 'text-gray-600'
            }`}
          >
            {wsTestMessage}
          </div>
        )}
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Configurações do sistema</h3>
        <p className="text-sm text-gray-600">Ajustes gerais da plataforma Linka Fleet.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600">Nome da plataforma</label>
          <input
            type="text"
            defaultValue="Linka Fleet"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Notificações</h3>
        <p className="text-sm text-gray-600">Configurações de alertas por e-mail e push (em breve).</p>
      </div>
    </div>
  );

  const tabContent = () => {
    switch (activeTab) {
      case 'maps':
        return renderMapsTab();
      case 'integrations':
        return renderIntegrationsTab();
      case 'system':
        return renderSystemTab();
      case 'notifications':
        return renderNotificationsTab();
      default:
        return renderMapsTab();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurações da plataforma</h2>
        <p className="text-gray-600">Personalize provedores de mapas, integrações e preferências gerais.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6 space-y-6">
          {tabContent()}
          <div className="pt-4 border-t border-gray-200 flex justify-end">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save size={16} />
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
