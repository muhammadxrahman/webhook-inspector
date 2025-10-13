const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { pool, initDB } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
// http server
const server = http.createServer(app);
// socket.io server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// store active connections per endpoint
const connections = new Map();

// websocket connection
io.on('connection', (socket) => {
  console.log('Client is connected: ', socket.id);

  // client subs to an endpoint
  socket.on('subscribe', (endpointId) => {
    console.log(`Client ${socket.id} subscribed to endpoint: ${endpointId}`);
    if (!connections.has(endpointId)) {
      connections.set(endpointId, new Set());
    }
    connections.get(endpointId).add(socket.id);

    socket.join(endpointId);
  
  });

  // client unsubs
  socket.on('unsubscribe', (endpointId) => {
    console.log(`Client ${socket.id} unsubscribed from endpoint: ${endpointId}`);
    socket.leave(endpointId);

    if (connections.has(endpointId)) {
      connections.get(endpointId).delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected: ', socket.id);
  

    // clean up connections
    connections.forEach((sockets, endpointId) => {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        connections.delete(endpointId);
      }
    });
  });
});


// root endpoint
app.get('/', (req, res) => {
    res.json({ 
      message: "Webhook Inspector API",
      status: 'running',
      socketio: 'enabled'
    });
});

// Webhook endpoint
app.post('/catch/:endpoint_id', (req, res) => {
    const {endpoint_id} = req.params;

    const webhookData = {
      id: Date.now(),
      endpoint_id,
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString()
    };
    
    console.log('\n Webhook has been recieved!');
    console.log('Endpoint ID:', endpoint_id);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Timestamp:', webhookData.timestamp);
    console.log('---\n');

    // broadcast to clients watching this endpoint
    io.to(endpoint_id).emit('webhook', webhookData);
    console.log(`Broadcasted to endpoint room: ${endpoint_id}`);

    res.json({ 
    success: true, 
    message: 'Webhook received',
    endpoint_id 
  });
    
});


// generate new endpoint in db
app.post('/api/endpoints/generate', async (req, res) => {
  try {
    const { endpoint_code } = req.body;
    if (!endpoint_code) {
      return res.status.json({
        success: false,
        message: 'endpoint_code is required'
      });
    }

    // check if already exists
    const existing = await pool.query(
      'select * from endpoints where endpoint_code = $1',
      [endpoint_code]
    );

    if (existing.rows.length > 0) {
      return res.json({ 
        success: true, 
        endpoint: existing.rows[0],
        message: 'Endpoint already exists'
      });
    }

    // create endpoint without user_id for temp anon
    const result = await pool.query(
      'INSERT INTO endpoints (endpoint_code) VALUES ($1) RETURNING *',
      [endpoint_code]
    );

    console.log('Endpoint registered: ', endpoint_code);

    res.json({ 
      success: true, 
      endpoint: result.rows[0],
      message: 'Endpoint created'
    });

  } catch (error) {
    console.error('Error when creating endpoint: ', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create endpoint',
      error: error.message
    });
  }
});


// init db then start server
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log("Socket.IO ready");
      console.log('Database connected');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database: ', error);
    process.exit(1);
  })