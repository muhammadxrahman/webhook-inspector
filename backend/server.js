const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { pool, initDB } = require('./database');
const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');
const { webhookRateLimit, endpointGenerationRateLimit, saveWebhookRateLimit } = require('./middleware/rateLimitMiddleware');


require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// http server
const server = http.createServer(app);
// socket.io server
const io = new Server(server, {
  cors: {
    origin: true,  // Allow all origins
    credentials: true
  }
});


// Middleware
// CORS configuration - allow all origins (webhooks can come from anywhere)
app.use(cors({
  origin: true,  // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api/auth', authRoutes);

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


// Validation rules helper funcs

// key exist in obj?
const hasKey = (obj, targetKey) => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  if (targetKey in obj) {
    return true;
  }

  // if nested
  for (let key in obj) {
    if (hasKey(obj[key], targetKey)) {
      return true;
    }
  }

  return false;
};

// Validate webhook against rules
const validateWebhook = async (endpoint_id, headers, body) => {
  try {
    const rulesResult = await pool.query(
      'SELECT * from validation_rules WHERE endpoint_id = $1',
      [endpoint_id]
    );

    const rules = rulesResult.rows;

    if (rules.length === 0) {
      return {
        passed: true,
        errors: null
      };
    }

    const errors = [];

    for (let rule of rules) {
      if (rule.rule_type === 'required_key') {
        if (!hasKey(body, rule.field_name)) {
          errors.push(`Missing required key: ${rule.field_name}`);
        }
      } else if (rule.rule_type === 'required_header') {
        const headerExists = queryObjects.keys(headers).some(
          h => h.toLowerCase() === rule.field_name.toLowerCase()
        );
        if (!headerExists) {
          errors.push(`Missing required header: ${rule.field_name}`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors.join('; ') : null
    };

  } catch (error) {
    console.error('Error validating webhook:', error);
    return {
      passed: true,
      errors: []
    };
  }
};


// webhook endpoint, rate limited
app.post('/catch/:endpoint_id', webhookRateLimit, (req, res) => {
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


// generate new endpoint in db, 1 per user
app.post('/api/endpoints/generate', authenticateToken, endpointGenerationRateLimit, async (req, res) => {
  try {
    const { endpoint_code } = req.body;
    const userId = req.user.userId;

    if (!endpoint_code) {
      return res.status(400).json({
        success: false,
        message: 'endpoint_code is required'
      });
    }

    // purge user's old endpoint data
    await pool.query(
      'DELETE FROM endpoints WHERE user_id = $1',
      [userId]
    );

    console.log('Deleted old endpoint for user :', userId);

    const result = await pool.query(
      'INSERT INTO endpoints (endpoint_code, user_id) VALUES ($1, $2) RETURNING *',
      [endpoint_code, userId]
    );

    console.log('Endpoint registered: ', endpoint_code, 'for user: ', userId);

    res.json({ 
      success: true, 
      endpoint: result.rows[0],
      message: 'Endpoint created (old endpoint deleted)'
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


// save webhook to db (REQUIRES AUTH)
app.post('/api/webhooks/save', authenticateToken, saveWebhookRateLimit, async (req, res) => {
  try {
    const { endpoint_code, headers, body, timestamp } = req.body;
    const userId = req.user.userId;

    if (!endpoint_code || !timestamp) {
      return res.status(400).json({
        success: false,
        message: 'endpoint_code and timestamp are required'
      });
    }

    // Get endpoint and verify ownership
    const endpointResult = await pool.query(
      'SELECT id FROM endpoints WHERE endpoint_code = $1 AND user_id = $2',
      [endpoint_code, userId]
    );

    if (endpointResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found or you do not have permission.' 
      });
    }

    const endpoint_id = endpointResult.rows[0].id;

    // Check saved webhook count (MAX 10)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM saved_webhooks WHERE endpoint_id = $1',
      [endpoint_id]
    );

    const savedCount = parseInt(countResult.rows[0].count);

    if (savedCount >= 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum 10 saved webhooks per endpoint. Delete old ones first.' 
      });
    }

    // Check if already saved
    const existing = await pool.query(
      'SELECT * FROM saved_webhooks WHERE endpoint_id = $1 AND timestamp = $2',
      [endpoint_id, timestamp]
    );

    if (existing.rows.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Webhook already saved',
        webhook: existing.rows[0]
      });
    }

    // Save webhook with user_id
    const result = await pool.query(
      `INSERT INTO saved_webhooks (endpoint_id, user_id, headers, body, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [endpoint_id, userId, JSON.stringify(headers), JSON.stringify(body), timestamp]
    );

    console.log('Webhook saved to database');

    res.json({ 
      success: true, 
      message: 'Webhook saved',
      webhook: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save webhook',
      error: error.message
    });
  }
});

// deprecated 
app.get('/api/webhooks/saved/:endpoint_code', async (req, res) => {
  try {
    const { endpoint_code } = req.params;

    const result = await pool.query(
      `SELECT sw.* 
       FROM saved_webhooks sw
       JOIN endpoints e ON sw.endpoint_id = e.id
       WHERE e.endpoint_code = $1
       ORDER BY sw.saved_at DESC`,
      [endpoint_code]
    );

    res.json({ 
      success: true, 
      count: result.rows.length,
      webhooks: result.rows 
    });
  } catch (error) {
    console.error('Error fetching saved webhooks:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch saved webhooks',
      error: error.message 
    });
  }
});


// get user's current endpoint
app.get('/api/endpoints/my-endpoint', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM endpoints WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        success: true, 
        endpoint: null,
        message: 'No endpoint found'
      });
    }

    res.json({ 
      success: true, 
      endpoint: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch endpoint',
      error: error.message 
    });
  }
});

// update endpoint name (REQUIRES AUTH)
app.patch('/api/endpoints/name', authenticateToken, async (req, res) => {
  try {
    const { endpoint_code, name } = req.body;
    const userId = req.user.userId;

    if (!endpoint_code) {
      return res.status(400).json({
        success: false,
        message: 'endpoint_code is required'
      });
    }

    const result = await pool.query(
      'UPDATE endpoints SET name = $1 WHERE endpoint_code = $2 AND user_id = $3 RETURNING *',
      [name || null, endpoint_code, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Endpoint not found or you do not have permission'
      });
    }

    console.log('📝 Endpoint name updated:', endpoint_code);

    res.json({
      success: true,
      endpoint: result.rows[0],
      message: 'Endpoint name updated'
    });
  } catch (error) {
    console.error('Error updating endpoint name:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update endpoint name',
      error: error.message
    });
  }
});


// Delete a saved webhook (REQUIRES AUTH)
app.delete('/api/webhooks/:webhook_id', authenticateToken, async (req, res) => {
  try {
    const { webhook_id } = req.params;
    const userId = req.user.userId;

    // Verify ownership before deleting
    const result = await pool.query(
      'DELETE FROM saved_webhooks WHERE id = $1 AND user_id = $2 RETURNING *',
      [webhook_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Webhook not found or you do not have permission to delete it' 
      });
    }

    console.log('Webhook deleted:', webhook_id);

    res.json({ 
      success: true, 
      message: 'Webhook deleted'
    });

  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete webhook',
      error: error.message 
    });
  }
});


// Validation rules endpoints

app.get('/api/validation-rules', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const endpointResult = await pool.query(
      'SELECT id FROM endpoints WHERE user_id = $1',
      [userId]
    );

    if (endpointResult.rows.length === 0) {
      return res.json({
        success: true,
        rules: []
      });
    }

    const endpoint_id = endpointResult.rows[0].id;

    const rulesResult = await pool.query(
      'SELECT * from validation_rules WHERE endpoint_id = $1 ORDER BY created_at ASC',
      [endpoint_id]
    );

    res.json({
      success: true,
      rules: result.rows
    });

  } catch (error) {
    console.error('Error fetching validation rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation rules',
      error: error.message
    });
  }
});


app.post('/api/validation-rules', authenticateToken, async (req, res) => {
  try {
    const { rule_type, field_name } = req.body;
    const userId = req.user.userId;

    if (!rule_type || !field_name) {
      return res.status(400).json({
        success: false,
        message: 'rule_type and field_name are required'
      });
    }

    const validTypes = ['required_key', 'required_header'];
    if (!validTypes.includes(rule_type)) {
      return res.status(400).json({
        success: false,
        message: 'rule_type must be either "required_key" or "required_header"'
      });
    }

    const endpointResult = await pool.query(
      'SELECT id FROM endpoints WHERE user_id = $1',
      [userId]
    );

    if (endpointResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No endpoint found. Generate an endpoint first.'
      });
    }

    const endpointId = endpointResult.rows[0].id;

    const existing = await pool.query(
      'SELECT * FROM validation_rules WHERE endpoint_id = $1 AND rule_type = $2 AND field_name = $3',
      [endpointId, rule_type, field_name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This validation rule already exists'
      });
    }

    const result = await pool.query(
      'INSERT INTO validation_rules (endpoint_id, rule_type, field_name) VALUES ($1, $2, $3) RETURNING *',
      [endpointId, rule_type, field_name]
    );

    console.log('Validation rule created:', rule_type, field_name);

    res.json({
      success: true,
      message: 'Validation rule created',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create validation rule',
      error: error.message
    });
  }
});


app.delete('/api/validation-rules/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `DELETE FROM validation_rules 
       WHERE id = $1 
       AND endpoint_id IN (SELECT id FROM endpoints WHERE user_id = $2)
       RETURNING *`,
      [ruleId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Validation rule not found or you do not have permission'
      });
    }

    console.log('Validation rule deleted:', ruleId);

    res.json({
      success: true,
      message: 'Validation rule deleted'
    });
  } catch (error) {
    console.error('Error deleting validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete validation rule',
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
