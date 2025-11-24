class RateLimiter {
    constructor() {
        this.requests = new Map();
    }

    // allowed?
    isAllowed(key, maxRequests, windowMs) {
        const now = Date.now();

        if(!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const keyRequests = this.requests.get(key);

        // clean old reqs outisde time window
        const validRequests = keyRequests.filter(timestamp => now - timestamp < windowMs);

        // limit exceeded?
        if (validRequests.length >= maxRequests) {
            return false;
        }

        // add curr request
        validRequests.push(now);
        this.requests.set(key, validRequests);
        return true;
    }

    // get remaining requests info
    getInfo(key, maxRequests, windowMs) {
        const now = Date.now();
        
        if (!this.requests.has(key)) {
        return {
            remaining: maxRequests,
            resetAt: now + windowMs
        };
        }
        
        const keyRequests = this.requests.get(key);
        const validRequests = keyRequests.filter(timestamp => now - timestamp < windowMs);
        
        const remaining = Math.max(0, maxRequests - validRequests.length);
        const oldestRequest = validRequests[0] || now;
        const resetAt = oldestRequest + windowMs;
        
        return {
        remaining,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000) // seconds
        };
    }

    // cleanup old data (run periodically)
    cleanup() {
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour
        
        for (const [key, timestamps] of this.requests.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < maxAge);
        
        if (validTimestamps.length === 0) {
            this.requests.delete(key);
        } else {
            this.requests.set(key, validTimestamps);
        }
        }
    }

}

const rateLimiter = new RateLimiter();

// Cleanup every 10 minutes
setInterval(() => {
  rateLimiter.cleanup();
  console.log('🧹 Rate limiter cleanup completed');
}, 10 * 60 * 1000);

module.exports = rateLimiter;