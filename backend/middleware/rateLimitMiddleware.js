const rateLimiter = require('../utilities/rateLimiter');

// get webhook rate limit, 10 per min per endpoint
const webhookRateLimit = (req, res, next) => {
  const endpoint_id = req.params.endpoint_id;
  const ip = req.ip || req.connection.remoteAddress;
  
  const endpointKey = `webhook:endpoint:${endpoint_id}`;
  const ipKey = `webhook:ip:${ip}`;
  
  // Check endpoint limit: 10 requests/minute
  const endpointAllowed = rateLimiter.isAllowed(endpointKey, 10, 60 * 1000);
  
  if (!endpointAllowed) {
    const info = rateLimiter.getInfo(endpointKey, 10, 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded for this endpoint. Max 10 webhooks per minute.',
      retryAfter: info.retryAfter
    });
  }
  
  // Check IP limit: 30 requests/minute
  const ipAllowed = rateLimiter.isAllowed(ipKey, 30, 60 * 1000);
  
  if (!ipAllowed) {
    const info = rateLimiter.getInfo(ipKey, 30, 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded for your IP. Max 30 webhooks per minute.',
      retryAfter: info.retryAfter
    });
  }
  
  next();
};


// saving webhooks limiter, 10 per min per user
const saveWebhookRateLimit = (req, res, next) => {
  const userId = req.user.userId; // From JWT
  
  const key = `webhook:save:${userId}`;
  
  // Check limit: 10 requests/minute
  const allowed = rateLimiter.isAllowed(key, 10, 60 * 1000);
  
  if (!allowed) {
    const info = rateLimiter.getInfo(key, 10, 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Max 10 webhook saves per minute.',
      retryAfter: info.retryAfter
    });
  }
  
  next();
};


// endpoint gen rate limiter
const endpointGenerationRateLimit = (req, res, next) => {
  const userId = req.user.userId; // From JWT
  
  const key = `endpoint:generation:${userId}`;
  
  // Check limit: 5 requests/hour
  const allowed = rateLimiter.isAllowed(key, 5, 60 * 60 * 1000);
  
  if (!allowed) {
    const info = rateLimiter.getInfo(key, 5, 60 * 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Max 5 endpoint generations per hour.',
      retryAfter: info.retryAfter
    });
  }
  
  next();
};


// 5 login attempts per 15 minutes per IP
const loginRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  const key = `auth:login:${ip}`;
  
  // check limit
  const allowed = rateLimiter.isAllowed(key, 5, 15 * 60 * 1000);
  
  if (!allowed) {
    const info = rateLimiter.getInfo(key, 5, 15 * 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      retryAfter: info.retryAfter
    });
  }
  
  next();
};

// 3 registrations per hour per IP
const registerRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  const key = `auth:register:${ip}`;
  
  const allowed = rateLimiter.isAllowed(key, 3, 60 * 60 * 1000);
  
  if (!allowed) {
    const info = rateLimiter.getInfo(key, 3, 60 * 60 * 1000);
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again later.',
      retryAfter: info.retryAfter
    });
  }
  
  next();
};

module.exports = { 
  webhookRateLimit, 
  endpointGenerationRateLimit, 
  saveWebhookRateLimit,
  loginRateLimit,
  registerRateLimit
};