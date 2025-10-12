import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

const API_URL = 'http://localhost:3001';

function App() {

  const [endpointId, setEndpointId] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);


  // initialize websocket connection
  useEffect(() => {
    socketRef.current = io(API_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    socketRef.current.on('webhook', (webhookData) => {
      console.log('Received webhook:', webhookData);
      setWebhooks(prev => [webhookData, ...prev]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };

  }, []);


  // sub/unsub to endpoint
  useEffect(() => {
    if (endpointId && socketRef.current) {
      console.log(`Subscribing to endpoint: ${endpointId}`);
      socketRef.current.emit('subscribe', endpointId);

      return () => {
        console.log(`Unsubscribing from endpoint: ${endpointId}`);
        socketRef.current.emit('unsubscribe', endpointId);
      };
    }
  }, [endpointId]);



  // generate a random endpoint id
  const generateEndpoint = () => {
    const randomId = Math.random().toString(36).substring(2,10);
    setEndpointId(randomId);
    setWebhooks([]); // clear previous webhooks
  };

  // send test webhook
  const sendTestWebhook = async () => {
    if (!endpointId) {
      alert("Please generate an endpoint first.");
      return;
    }

    const testPayload = {
      event: 'test.webhook',
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook!",
        user_id: 12345,
        amount: 99.99
      }
    };

    try {
      await axios.post(`${API_URL}/catch/${endpointId}`, testPayload);

      // local display until websockets
      // setWebhooks(prev => [{
      //   id: Date.now(),
      //   headers: {'content-type': 'application/json'},
      //   body: testPayload,
      //   timestamp: new Date().toISOString()
      // }, ...prev]);

      console.log('Test webhook sent');

    } catch (error) {
      console.error('Error sending webhook:', error);
      alert('Failed to send test webhook');
    }

  };

  const copyToClipboard = () => {
    const url = `${API_URL}/catch/${endpointId}`;
    navigator.clipboard.writeText(url);
    alert('Copied to clipboard!');
  };

  return (
    <div className="App">
      <header>
        <h1>🎯 Webhook Inspector</h1>
        <p>Receive and inspect webhooks in real-time</p>
        <div className="connection-status">
          {isConnected ? (
            <span className="status-connected">🟢 Connected</span>
          ) : (
            <span className="status-disconnected">🔴 Disconnected</span>
          )}
        </div>
      </header>
      <main>

        {/* Generate Endpoint Section */}
        <div className="section">
          {!endpointId ? (
            <button onClick={generateEndpoint} className="btn-primary">
              Generate Endpoint
            </button>
          ) : (
            <div className="endpoint-display">
              <h3>Your Endpoint:</h3>
              <div className="endpoint-url">
                <code>{API_URL}/catch/{endpointId}</code>
                <button onClick={copyToClipboard} className="btn-copy">
                  Copy
                </button>
              </div>
              <button onClick={generateEndpoint} className="btn-secondary">
                Generate New
              </button>
            </div>
          )}
        </div>

        {/* Test Webhook Section */}
        {endpointId && (
          <div className="section">
            <h3>Quick Test:</h3>
            <button onClick={sendTestWebhook} className="btn-test">
              🚀 Send Test Webhook
            </button>
            <p className="hint">Or send a POST request to your endpoint from any tool</p>
          </div>
        )}

        {/* Webhooks Display */}
        {endpointId && (
          <div className="section">
            <h3>Received Webhooks ({webhooks.length}):</h3>
            {webhooks.length === 0 ? (
              <p className="empty-state">Waiting for webhooks...</p>
            ) : (
              <div className="webhooks-list">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="webhook-card">
                    <div className="webhook-header">
                      <span className="timestamp">{webhook.timestamp}</span>
                      <span className="badge">NEW</span>
                    </div>
                    <div className="webhook-content">
                      <h4>Headers:</h4>
                      <pre>{JSON.stringify(webhook.headers, null, 2)}</pre>
                      <h4>Body:</h4>
                      <pre>{JSON.stringify(webhook.body, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
