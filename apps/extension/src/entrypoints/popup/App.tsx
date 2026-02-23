import { useState, useEffect } from 'react';
import { APP_NAME } from '@browser-cli/shared';
import { getState, setPort, CONFIGURED_WS_PORT } from '../../lib/state';
import type { ConnectionState } from '../../lib/state';

export default function App() {
  const [state, setStateLocal] = useState<ConnectionState>({
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
    // Get initial state from storage
    void getState().then((s) => {
      console.log('[browser-cli] Popup initial state:', s);
      setStateLocal(s);
      setPortInput(String(s.port));
    });

    // Query background for real-time connection status
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

    // Listen for state changes
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

  return (
    <div
      style={{
        width: 380,
        background: '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: '#000',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid #eaeaea',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.2px',
          }}
        >
          {APP_NAME}
        </h1>
      </div>

      {/* Status */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #eaeaea',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: state.connected ? '#0070f3' : '#999',
              }}
            />
            <span
              style={{
                fontSize: 14,
                color: '#666',
              }}
            >
              {state.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {state.reconnecting && (
            <span
              style={{
                fontSize: 12,
                color: '#999',
              }}
            >
              Reconnecting...
            </span>
          )}
        </div>
        {state.sessionId && (
          <div
            onClick={() => void copySessionId()}
            title="Click to copy full session ID"
            style={{
              fontSize: 11,
              color: '#666',
              marginTop: 8,
              fontFamily: 'Menlo, Monaco, monospace',
              background: '#fafafa',
              border: '1px solid #eaeaea',
              borderRadius: 4,
              padding: '6px 8px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.background = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#eaeaea';
              e.currentTarget.style.background = '#fafafa';
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.sessionId}
            </span>
            <span
              style={{
                fontSize: 10,
                color: sessionCopied ? '#0070f3' : '#999',
                marginLeft: 8,
                flexShrink: 0,
              }}
            >
              {sessionCopied ? '✓' : '⎘'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        {!state.connected && (
          <div
            style={{
              background: '#fafafa',
              border: '1px solid #eaeaea',
              borderRadius: 5,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: '#666',
                marginBottom: 12,
              }}
            >
              Start the daemon in your terminal:
            </div>
            <div
              style={{
                background: '#000',
                borderRadius: 5,
                padding: '10px 12px',
                marginBottom: 12,
                fontFamily: 'Menlo, Monaco, monospace',
                fontSize: 12,
                color: '#0070f3',
              }}
            >
              $ browser-cli start
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                onClick={() => void copyCommand()}
                style={{
                  flex: 1,
                  height: 32,
                  fontSize: 12,
                  fontWeight: 500,
                  background: copied ? '#000' : '#fff',
                  color: copied ? '#fff' : '#000',
                  border: '1px solid #eaeaea',
                  borderRadius: 5,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => {
                  if (!copied) {
                    e.currentTarget.style.borderColor = '#000';
                  }
                }}
                onMouseOut={(e) => {
                  if (!copied) {
                    e.currentTarget.style.borderColor = '#eaeaea';
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleReconnect}
                style={{
                  flex: 1,
                  height: 32,
                  fontSize: 12,
                  fontWeight: 500,
                  background: '#000',
                  color: '#fff',
                  border: '1px solid #000',
                  borderRadius: 5,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#333';
                  e.currentTarget.style.borderColor = '#333';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#000';
                  e.currentTarget.style.borderColor = '#000';
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Settings */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: '#666',
              marginBottom: 8,
            }}
          >
            WebSocket Port
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              placeholder="9222"
              style={{
                flex: 1,
                height: 32,
                padding: '0 10px',
                fontSize: 14,
                background: '#fff',
                color: '#000',
                border: '1px solid #eaeaea',
                borderRadius: 5,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#000';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#eaeaea';
              }}
            />
            <button
              onClick={handlePortSave}
              style={{
                height: 32,
                padding: '0 16px',
                fontSize: 12,
                fontWeight: 500,
                background: '#000',
                color: '#fff',
                border: '1px solid #000',
                borderRadius: 5,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#333';
                e.currentTarget.style.borderColor = '#333';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#000';
                e.currentTarget.style.borderColor = '#000';
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Footer */}
        {(state.lastConnected || state.lastDisconnected) && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid #eaeaea',
              fontSize: 11,
              color: '#999',
            }}
          >
            {state.lastConnected && (
              <div>Connected: {new Date(state.lastConnected).toLocaleTimeString()}</div>
            )}
            {state.lastDisconnected && (
              <div style={{ marginTop: 4 }}>
                Disconnected: {new Date(state.lastDisconnected).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
