import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './AuthContext';
import Auth from './Auth';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://webhook-inspector-production-2c87.up.railway.app';

function App() {

  const { user, loading, logout, token } = useAuth();

  const [endpointId, setEndpointId] = useState(null);
  const [webhooks, setWebhooks] = useState([]); // Live webhooks (ephemeral)
  const [savedWebhooks, setSavedWebhooks] = useState([]); // Saved webhooks (persistent)
  const [isConnected, setIsConnected] = useState(false);
  const [testButtonClicks, setTestButtonClicks] = useState([]);
  const socketRef = useRef(null);


  // clear state when user changes or logs out
  useEffect(() => {
    if (!user) {
      setEndpointId(null);
      setWebhooks([]);
      setSavedWebhooks([]);
    }
  }, [user]);

  // load user's data on login
  useEffect(() => {
    const loadUserEndpoint = async () => {
      if (user && token) {
        try {
          const response = await axios.get(`${API_URL}/api/endpoints/my-endpoint`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.data.success && response.data.endpoint) {
            const endpoint = response.data.endpoint;
            setEndpointId(endpoint.endpoint_code);
            console.log('Loaded existing endpoint:', endpoint.endpoint_code);
          }
        } catch (error) {
          console.error('Error loading endpoint:', error);
        }
      }
    };

    loadUserEndpoint();
  }, [user, token]);


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

      // load saved webhooks when endpoint loads
      loadSavedWebhooks(endpointId);

      return () => {
        console.log(`Unsubscribing from endpoint: ${endpointId}`);
        socketRef.current.emit('unsubscribe', endpointId);
      };
    }
  }, [endpointId]);

  // load saved webhooks from db
  const loadSavedWebhooks = async (endpoint_code) => {
    try {
      const response = await axios.get(`${API_URL}/api/webhooks/saved/${endpoint_code}`);
      if (response.data.success) {
        setSavedWebhooks(response.data.webhooks);
        console.log(`Loaded ${response.data.count} saved webhooks`);
      }
    } catch (error) {
      console.error('Error loading saved webhooks: ', error);
    }
  };


  // generate and register random endpoint_id 
  const generateEndpoint = async () => {
    const randomId = Math.random().toString(36).substring(2,10);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/endpoints/generate`, 
        { endpoint_code: randomId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setEndpointId(randomId);
        setWebhooks([]); // clear live webhooks
        setSavedWebhooks([]); // clear saved webhooks
        console.log('Endpoint registered:', randomId);
      }
    } catch (error) {
      console.error('Error registering endpoint:', error);
      alert(error.response?.data?.message || 'Failed to generate endpoint');
    }
  };


  // max 5 clicks per min
  const isTestButtonRateLimited = () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // filter clicks within last minute
    const recentClicks = testButtonClicks.filter(timestamp => timestamp > oneMinuteAgo);
    
    return recentClicks.length >= 5;
  };
  

  // send test webhook
  const sendTestWebhook = async () => {
    if (!endpointId) {
      alert("Please generate an endpoint first.");
      return;
    }

    // Check frontend rate limit
    if (isTestButtonRateLimited()) {
      alert("Slow down! Max 5 test webhooks per minute.\n\nWait a moment before trying again.");
      return;
    }

    // Record this click
    const now = Date.now();
    setTestButtonClicks(prev => [...prev.filter(t => t > now - 60000), now]);

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
      console.log('Test webhook sent');
    } catch (error) {
      console.error('Error sending webhook:', error);
      
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        const message = error.response?.data?.message || 'Rate limit exceeded';
        const retryAfter = error.response?.data?.retryAfter;
        alert(`⏳ ${message}${retryAfter ? `\n\nTry again in ${retryAfter} seconds.` : ''}`);
      } else {
        alert('Failed to send test webhook');
      }
    }
  };


  // save webhook to db
  const saveWebhook = async (webhook) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/webhooks/save`,
        {
          endpoint_code: endpointId,
          headers: webhook.headers,
          body: webhook.body,
          timestamp: webhook.timestamp
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Reload saved webhooks to show the new one
        loadSavedWebhooks(endpointId);
        console.log('Webhook saved');
        alert('Webhook saved successfully!');
      }
    } catch (error) {
      console.error('Error saving webhook:', error);
      
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        const message = error.response?.data?.message || 'Rate limit exceeded';
        const retryAfter = error.response?.data?.retryAfter;
        alert(`⏳ ${message}${retryAfter ? `\n\nTry again in ${retryAfter} seconds.` : ''}`);
      } else {
        alert(error.response?.data?.message || 'Failed to save webhook');
      }
    }
  };


  // delete saved webhook
  const deleteWebhook = async (webhookId) => {
    if (!window.confirm('Are you sure you want to delete this saved webhook?')) {
      return;
    }

    try {
      const response = await axios.delete(
        `${API_URL}/api/webhooks/${webhookId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Reload saved webhooks to remove the deleted one
        loadSavedWebhooks(endpointId);
        console.log('Webhook deleted');
        alert('Webhook deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      alert(error.response?.data?.message || 'Failed to delete webhook');
    }
  };


  // check if webhook is saved
  const isWebhookSaved = (webhook) => {
    return savedWebhooks.some(sw => sw.timestamp === webhook.timestamp);
  };

  const copyToClipboard = () => {
    const url = `${API_URL}/catch/${endpointId}`;
    navigator.clipboard.writeText(url);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="App">
        <header>
          <h1>Webhook Inspector 🎯</h1>
          <p>Receive and inspect webhooks in real-time</p>
        </header>
        <main>
          <p>Loading...</p>
        </main>
      </div>
    );
  }


  if (!user) {
    return <Auth />;
  }

  return (
    <div className="App">
      <header>
        <h1>Webhook Inspector 🎯</h1>
        <p>Receive and inspect webhooks in real-time</p>
        <div className="header-actions">
          <span>Welcome, {user.username}!</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
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
                Generate New (Deletes Current)
              </button>
            </div>
          )}
        </div>

        {/* Test Webhook */}
        {endpointId && (
          <div className="section">
            <h3>Quick Test:</h3>
            <button onClick={sendTestWebhook} className="btn-test">
              Send Test Webhook
            </button>
            <p className="hint">Or send a POST request to your endpoint from any tool, including cURL!</p>
            
            {/* Curl Block */}
            <div className="curl-block">
              <div className="curl-header">
                <span>cURL Command:</span>
                <button 
                  onClick={() => {
                    const curlCommand = `curl -X POST ${API_URL}/catch/${endpointId} \\
          -H "Content-Type: application/json" \\
          -d '{"event":"test","source":"curl","message":"Hello from terminal!"}'`;
                    navigator.clipboard.writeText(curlCommand);
                    alert('cURL command copied to clipboard!');
                  }}
                  className="btn-copy-curl"
                >
                  Copy
                </button>
              </div>
              <pre className="curl-command">
        {`curl -X POST ${API_URL}/catch/${endpointId} \\
          -H "Content-Type: application/json" \\
          -d '{"event":"test","source":"curl","message":"Hello from terminal!"}'`}
              </pre>
            </div>
          </div>
        )}

        {/* Live Webhooks Display */}
        {endpointId && (
          <div className="section">
            <h3>Live Webhooks ({webhooks.length}):</h3>
            <p className="hint">These disappear on refresh. Click "Save?" to persist them.</p>
            {webhooks.length === 0 ? (
              <p className="empty-state">Waiting for webhooks...</p>
            ) : (
              <div className="webhooks-list">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="webhook-card">
                    <div className="webhook-header">
                      <span className="timestamp">{webhook.timestamp}</span>
                      <div className="webhook-actions">
                        <button 
                          onClick={() => saveWebhook(webhook)}
                          className="btn-save"
                          disabled={isWebhookSaved(webhook)}
                        >
                          {isWebhookSaved(webhook) ? 'Saved!' : 'Save?'}
                        </button>
                      </div>
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

        {/* Saved Webhooks Display */}
        {endpointId && savedWebhooks.length > 0 && (
          <div className="section">
            <h3>Saved Webhooks ({savedWebhooks.length}/10):</h3>
            <div className="webhooks-list">
              {savedWebhooks.map(webhook => {
                // Parse headers and body if they're strings
                const headers = typeof webhook.headers === 'string' 
                  ? JSON.parse(webhook.headers) 
                  : webhook.headers;
                const body = typeof webhook.body === 'string' 
                  ? JSON.parse(webhook.body) 
                  : webhook.body;

                return (
                  <div key={webhook.id} className="webhook-card saved">
                    <div className="webhook-header">
                      <span className="timestamp">{webhook.timestamp}</span>
                      <div className="webhook-actions">
                        <span className="badge">SAVED</span>
                        <button 
                          onClick={() => deleteWebhook(webhook.id)}
                          className="btn-delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="webhook-content">
                      <h4>Headers:</h4>
                      <pre>{JSON.stringify(headers, null, 2)}</pre>
                      <h4>Body:</h4>
                      <pre>{JSON.stringify(body, null, 2)}</pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;