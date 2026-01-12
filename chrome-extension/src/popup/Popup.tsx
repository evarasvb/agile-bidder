import React, { useState, useEffect } from 'react';
import type { ClienteInfo, MatchOportunidad, ExtensionSettings } from '../utils/types';

type View = 'loading' | 'login' | 'main' | 'settings';

interface Config {
  apiKey: string | null;
  clienteInfo: ClienteInfo | null;
  settings: ExtensionSettings;
}

export default function Popup() {
  const [view, setView] = useState<View>('loading');
  const [config, setConfig] = useState<Config | null>(null);
  const [matches, setMatches] = useState<MatchOportunidad[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (response.success) {
        setConfig(response.data);
        
        if (response.data.apiKey && response.data.clienteInfo) {
          setView('main');
          loadMatches();
        } else {
          setView('login');
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setView('login');
    }
  };

  const loadMatches = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_MATCHES' });
      if (response.success) {
        setMatches(response.data.matches || []);
        setLastSync(response.data.lastSync);
      }
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleLogin = async () => {
    if (!apiKeyInput.trim()) {
      setLoginError('Ingresa tu API Key');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'SET_CONFIG',
        payload: { apiKey: apiKeyInput.trim() }
      });

      if (response.success) {
        setConfig(prev => ({
          ...prev!,
          apiKey: apiKeyInput,
          clienteInfo: response.data.clienteInfo
        }));
        setView('main');
        loadMatches();
      } else {
        setLoginError(response.error || 'Error al conectar');
      }
    } catch (error) {
      setLoginError('Error de conexión');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'SYNC_MATCHES' });
      if (response.success) {
        setMatches(response.data.matches || []);
        setLastSync(new Date().toISOString());
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await chrome.storage.local.clear();
    setConfig(null);
    setMatches([]);
    setApiKeyInput('');
    setView('login');
  };

  const openLicitacion = (url: string) => {
    chrome.tabs.create({ url });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(value);
  };

  if (view === 'loading') {
    return (
      <div className="popup-container loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h1>FirmaVB Postulador</h1>
          <p className="subtitle">Conecta con tu cuenta FirmaVB</p>
        </header>

        <main className="popup-content login-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="fvb_ext_xxxxxxxxxxxx"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <p className="help-text">
              Obtén tu API Key en la configuración de FirmaVB
            </p>
          </div>

          {loginError && (
            <div className="error-message">{loginError}</div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleLogin}
            disabled={loginLoading}
          >
            {loginLoading ? 'Conectando...' : 'Conectar'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <header className="popup-header compact">
        <div className="header-row">
          <div className="logo-small">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="header-info">
            <h1>FirmaVB</h1>
            <p className="empresa">{config?.clienteInfo?.empresa}</p>
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setView('settings')} title="Configuración">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="sync-bar">
        <span className="sync-info">
          {lastSync ? `Última sync: ${formatDate(lastSync)}` : 'Sin sincronizar'}
        </span>
        <button className="btn-sync" onClick={handleSync} disabled={syncing}>
          <svg className={syncing ? 'spinning' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      <main className="popup-content">
        <h2 className="section-title">
          Oportunidades con Match
          <span className="badge">{matches.length}</span>
        </h2>

        {matches.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <p>No hay oportunidades con match</p>
            <span>Sincroniza para buscar nuevas</span>
          </div>
        ) : (
          <div className="matches-list">
            {matches.map((match) => (
              <div key={match.oferta_id} className="match-card">
                <div className="match-header">
                  <span className={`score score-${match.match_score >= 80 ? 'high' : match.match_score >= 60 ? 'medium' : 'low'}`}>
                    {match.match_score}%
                  </span>
                  <span className={`estado estado-${match.estado}`}>
                    {match.estado}
                  </span>
                </div>
                
                <h3 className="match-title">{match.titulo}</h3>
                <p className="match-org">{match.organismo}</p>
                
                <div className="match-details">
                  <div className="detail">
                    <span className="label">Presupuesto</span>
                    <span className="value">{formatCurrency(match.presupuesto)}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Cierra</span>
                    <span className="value">{formatDate(match.fecha_cierre)}</span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => openLicitacion(match.link_oficial || `https://www.mercadopublico.cl/CompraAgil/Ficha/${match.licitacion_id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Ir a Postular
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {view === 'settings' && (
        <div className="settings-overlay" onClick={() => setView('main')}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Configuración</h2>
            
            <div className="settings-section">
              <h3>Cuenta</h3>
              <p className="settings-info">
                <strong>{config?.clienteInfo?.empresa}</strong><br/>
                Categoría: {config?.clienteInfo?.categoria}
              </p>
              <button className="btn btn-danger" onClick={handleLogout}>
                Desconectar
              </button>
            </div>

            <button className="btn-close" onClick={() => setView('main')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
