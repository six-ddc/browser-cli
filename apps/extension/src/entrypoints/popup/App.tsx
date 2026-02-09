import { useState, useEffect } from 'react';
import { APP_NAME, DEFAULT_WS_PORT } from '@browser-cli/shared';
import { getState, setPort } from '../../lib/state';
import type { ConnectionState } from '../../lib/state';

export default function App() {
  const [state, setStateLocal] = useState<ConnectionState>({
    connected: false,
    sessionId: null,
    port: DEFAULT_WS_PORT,
    lastConnected: null,
    lastDisconnected: null,
  });
  const [portInput, setPortInput] = useState(String(DEFAULT_WS_PORT));

  useEffect(() => {
    getState().then((s) => {
      setStateLocal(s);
      setPortInput(String(s.port));
    });

    // Listen for state changes
    const listener = (changes: { [key: string]: Browser.storage.StorageChange }) => {
      if (changes.browserCliState?.newValue) {
        setStateLocal(changes.browserCliState.newValue as ConnectionState);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const handlePortSave = () => {
    const p = parseInt(portInput, 10);
    if (p > 0 && p < 65536) {
      setPort(p);
    }
  };

  return (
    <div style={{ padding: 16, minWidth: 320, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: '0 0 12px' }}>{APP_NAME}</h2>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: state.connected ? '#22c55e' : '#ef4444',
              display: 'inline-block',
            }}
          />
          <strong>{state.connected ? 'Connected' : 'Disconnected'}</strong>
        </div>
        {state.sessionId && (
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Session: {state.sessionId.slice(0, 8)}...
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          Daemon WebSocket Port
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="number"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            style={{ width: 80, padding: '4px 8px' }}
          />
          <button onClick={handlePortSave} style={{ padding: '4px 12px' }}>
            Save
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#888' }}>
        {state.lastConnected && (
          <div>Last connected: {new Date(state.lastConnected).toLocaleTimeString()}</div>
        )}
        {state.lastDisconnected && (
          <div>Last disconnected: {new Date(state.lastDisconnected).toLocaleTimeString()}</div>
        )}
      </div>
    </div>
  );
}
