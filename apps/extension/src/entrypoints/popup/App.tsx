import { useState, useEffect } from 'react';
import { APP_NAME } from '@browser-cli/shared';
import {
  getState,
  setState,
  setHost,
  setPort,
  setToken,
  getToken,
  CONFIGURED_WS_HOST,
  CONFIGURED_WS_PORT,
} from '../../lib/state';
import type { ConnectionState } from '../../lib/state';
import './App.css';

/* Inline SVG icons (Material Symbols style) */
const CopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function App() {
  const [state, setStateLocal] = useState<ConnectionState>({
    enabled: true,
    connected: false,
    sessionId: null,
    host: CONFIGURED_WS_HOST,
    port: CONFIGURED_WS_PORT,
    lastConnected: null,
    lastDisconnected: null,
    reconnecting: false,
    nextRetryIn: null,
    authFailed: false,
  });
  const [hostInput, setHostInput] = useState(CONFIGURED_WS_HOST);
  const [portInput, setPortInput] = useState(String(CONFIGURED_WS_PORT));
  const [tokenInput, setTokenInput] = useState('');
  const [savedToken, setSavedToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  /** Whether the current host is non-loopback (auto-show token field) */
  const isNonLoopback = !['127.0.0.1', 'localhost', '::1'].includes(state.host);
  const [showToken, setShowToken] = useState(false);

  /** Track whether any settings have been modified */
  const isDirty =
    hostInput.trim() !== state.host ||
    portInput.trim() !== String(state.port) ||
    tokenInput.trim() !== savedToken;

  useEffect(() => {
    void getState().then((s) => {
      console.log('[browser-cli] Popup initial state:', s);
      setStateLocal(s);
      setHostInput(s.host);
      setPortInput(String(s.port));
    });
    void getToken().then((t) => {
      setTokenInput(t);
      setSavedToken(t);
    });

    void browser.runtime
      .sendMessage({ type: 'getConnectionState' })
      .then((response: { connected: boolean; sessionId: string | null }) => {
        console.log('[browser-cli] Background connection state:', response);
        setStateLocal((prev) => ({
          ...prev,
          connected: response.connected,
          sessionId: response.sessionId,
        }));
      })
      .catch((err: unknown) => {
        console.error('[browser-cli] Failed to query connection state:', err);
      });

    const listener = (changes: { [key: string]: Browser.storage.StorageChange }) => {
      console.log('[browser-cli] Popup storage changed:', changes);
      const stateChange = changes['browserCliState'];
      if (stateChange.newValue) {
        const newState = stateChange.newValue as ConnectionState;
        console.log('[browser-cli] Popup updating state:', newState);
        setStateLocal(newState);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const handleSaveAll = () => {
    const h = hostInput.trim();
    if (h && h !== state.host) {
      void setHost(h);
    }
    const p = parseInt(portInput, 10);
    if (p && p > 0 && p < 65536 && p !== state.port) {
      void setPort(p);
    }
    const t = tokenInput.trim();
    if (t !== savedToken) {
      void setToken(t);
      setSavedToken(t);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText('browser-cli start');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReconnect = () => {
    void browser.runtime.sendMessage({ type: 'reconnect' });
  };

  const copySessionId = async () => {
    if (state.sessionId) {
      await navigator.clipboard.writeText(state.sessionId);
      setSessionCopied(true);
      setTimeout(() => setSessionCopied(false), 2000);
    }
  };

  const handleToggle = () => {
    void setState({ enabled: !state.enabled });
  };

  const statusVariant = !state.enabled
    ? 'disabled'
    : state.authFailed
      ? 'auth_failed'
      : state.reconnecting
        ? 'reconnecting'
        : state.connected
          ? 'connected'
          : 'disconnected';

  const statusLabel = !state.enabled
    ? 'Disabled'
    : state.authFailed
      ? 'Auth Failed'
      : state.reconnecting
        ? 'Reconnecting...'
        : state.connected
          ? 'Connected'
          : 'Disconnected';

  return (
    <div className="popup">
      {/* Header */}
      <div className="header">
        <div className="header-icon">B</div>
        <span className="header-title">{APP_NAME}</span>
        <div className={`status-chip status-chip--${statusVariant}`}>
          <div className={`status-dot status-dot--${statusVariant}`} />
          {statusLabel}
        </div>
        {state.reconnecting && state.nextRetryIn != null && (
          <span className="status-retry">Retry in {state.nextRetryIn}s</span>
        )}
        <label className="toggle-switch">
          <input type="checkbox" checked={state.enabled} onChange={handleToggle} />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Session ID */}
      {state.sessionId && (
        <div className="settings">
          <label className="settings-label">Session</label>
          <div
            className="session-row"
            onClick={() => void copySessionId()}
            title="Click to copy session ID"
          >
            <span className="session-id">{state.sessionId}</span>
            <button className={`copy-btn ${sessionCopied ? 'copy-btn--copied' : ''}`} tabIndex={-1}>
              {sessionCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
      )}

      {/* Disconnected guide (hidden when intentionally disabled) */}
      {state.enabled && !state.connected && (
        <div className="guide-card">
          <span className="guide-label">Start the daemon in your terminal</span>
          <div className="guide-code">
            <span>$</span>browser-cli start
          </div>
          <div className="guide-actions">
            <button
              className={`btn ${copied ? 'btn--tonal-success' : 'btn--tonal'} btn--flex`}
              onClick={() => void copyCommand()}
            >
              {copied ? (
                <>
                  <CheckIcon /> Copied
                </>
              ) : (
                <>
                  <CopyIcon /> Copy
                </>
              )}
            </button>
            <button className="btn btn--primary btn--flex" onClick={handleReconnect}>
              Retry connection
            </button>
          </div>
        </div>
      )}

      {/* Settings */}
      <details className="settings-details">
        <summary className="settings-summary">Settings</summary>
        <div className="settings">
          <label className="settings-label">Daemon Host</label>
          <input
            type="text"
            className="input-field"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            placeholder="127.0.0.1"
            onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveAll()}
          />
          {isNonLoopback || showToken || state.authFailed ? (
            <>
              <label className="settings-label" style={{ marginTop: 4 }}>
                Auth Token
              </label>
              <input
                type="password"
                className="input-field"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token from daemon log"
                onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveAll()}
              />
            </>
          ) : (
            <button
              className="btn btn--tonal"
              style={{ marginTop: 4, fontSize: 12 }}
              onClick={() => setShowToken(true)}
            >
              Set auth token...
            </button>
          )}
          <label className="settings-label" style={{ marginTop: 4 }}>
            WebSocket Port
          </label>
          <input
            type="text"
            className="input-field"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            placeholder="9222"
            onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveAll()}
          />
          {(isDirty || saved) && (
            <button
              className={`btn btn--save-all ${saved ? 'btn--tonal-success' : 'btn--primary'}`}
              onClick={handleSaveAll}
            >
              {saved ? (
                <>
                  <CheckIcon /> Saved
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>
      </details>

      {/* Footer timestamps */}
      {(state.lastConnected || state.lastDisconnected) && (
        <>
          <div className="divider" />
          <div className="footer">
            {state.lastConnected && (
              <span>Connected {new Date(state.lastConnected).toLocaleTimeString()}</span>
            )}
            {state.lastDisconnected && (
              <span>Disconnected {new Date(state.lastDisconnected).toLocaleTimeString()}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
