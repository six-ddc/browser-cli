import { useState, useEffect } from 'react';
import { APP_NAME } from '@browser-cli/shared';
import { getState, setState, setPort, CONFIGURED_WS_PORT } from '../../lib/state';
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
    port: CONFIGURED_WS_PORT,
    lastConnected: null,
    lastDisconnected: null,
    reconnecting: false,
    nextRetryIn: null,
  });
  const [portInput, setPortInput] = useState(String(CONFIGURED_WS_PORT));
  const [copied, setCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

  useEffect(() => {
    void getState().then((s) => {
      console.log('[browser-cli] Popup initial state:', s);
      setStateLocal(s);
      setPortInput(String(s.port));
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

  const handlePortSave = () => {
    const p = parseInt(portInput, 10);
    if (!p || p <= 0 || p >= 65536) {
      setPortInput(String(state.port));
      return;
    }
    void setPort(p);
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
    : state.reconnecting
      ? 'reconnecting'
      : state.connected
        ? 'connected'
        : 'disconnected';

  const statusLabel = !state.enabled
    ? 'Disabled'
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
        <label className="toggle-switch">
          <input type="checkbox" checked={state.enabled} onChange={handleToggle} />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Status */}
      <div className="status-bar">
        <div className={`status-chip status-chip--${statusVariant}`}>
          <div className={`status-dot status-dot--${statusVariant}`} />
          {statusLabel}
        </div>
        {state.reconnecting && state.nextRetryIn != null && (
          <span className="status-retry">Retry in {state.nextRetryIn}s</span>
        )}
      </div>

      {/* Session ID */}
      {state.sessionId && (
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

      <div className="divider" />

      {/* Settings */}
      <div className="settings">
        <label className="settings-label">WebSocket Port</label>
        <div className="settings-row">
          <input
            type="text"
            className="input-field"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            placeholder="9222"
            onKeyDown={(e) => e.key === 'Enter' && handlePortSave()}
          />
          <button className="btn btn--primary" onClick={handlePortSave}>
            Save
          </button>
        </div>
      </div>

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
