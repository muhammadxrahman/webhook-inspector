# Webhook Inspector

**Live Site:** https://webhook-inspector-nine.vercel.app/

A real-time webhook inspection tool for developers. Receive, inspect, and debug webhooks during development with persistent storage and user authentication.

## Features

- Real-time webhook reception and display via WebSockets
- User authentication with secure JWT tokens
- Persistent webhook storage (save up to 10 per endpoint)
- One endpoint per user with instant generation
- Custom endpoint naming and descriptions
- Comprehensive rate limiting on all routes
- Full request inspection (headers, body, timestamps)
- Built-in test webhook functionality
- Optional validation rules with status indicators for header and body keys

## Tech Stack

**Frontend:** React, Socket.IO Client, Axios  
**Backend:** Node.js, Express, Socket.IO, PostgreSQL  
**Deployment:** Vercel (frontend), Railway (backend + database)

## Security Features

- Password hashing with bcrypt
- JWT authentication with 7-day token expiry
- Rate limiting on all endpoints (6 different limits)
- Input sanitization for user-provided data
- HTTPS enforcement in production
- Security headers via Helmet
- SQL injection prevention via parameterized queries
- User data isolation

## Project Structure
```
webhook-inspector/
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── routes/
│   │   └── auth.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rateLimitMiddleware.js
│   └── utils/
│       └── rateLimiter.js
├── frontend/
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── Auth.js
│       ├── Auth.css
│       └── AuthContext.js
└── docker-compose.yml
```

## Local Development

### Prerequisites

- Node.js v18+
- PostgreSQL v14+ (or Docker)
- npm or yarn

### Setup

1. Clone and install dependencies:
```bash
git clone https://github.com/muhammadxrahman/webhook-inspector.git
cd webhook-inspector
cd backend && npm install
cd ../frontend && npm install
```
2. Start PostgreSQL (using Docker):
```bash
docker compose up -d
```
3. Configure backend environment (`backend/.env`):
```
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/webhook_inspector
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

4. Start services:
```bash
# Terminal 1 - Backend
cd backend && npm run dev
# Terminal 2 - Frontend
cd frontend && npm start
```
5. Open http://localhost:3000

## Usage


### Basic User Workflow
1. Register an account or log in
2. Generate your unique webhook endpoint
3. (Optional) Add a custom name or description to your endpoint
4. (Optional) Configure validation rules for required headers or body keys
5. Configure third-party services (GitHub, Stripe, Discord, etc.) to send webhooks to your endpoint
6. View incoming webhooks in real-time
7. Save important webhooks for later reference (up to 10 per endpoint)
8. Delete saved webhooks when no longer needed

### Validation Rules

Define optional validation rules to flag webhooks that don't meet your requirements:

- **Required Headers:** Ensure webhooks include specific headers (e.g., `X-Webhook-Signature`)
- **Required Body Keys:** Ensure webhooks include specific JSON keys (e.g., `user_id`, `event`)

Webhooks that fail validation are marked with a warning indicator but still saved for inspection.

### Testing Webhooks

**Using the built-in test button:**
Click "Send Test Webhook" to send a sample payload to your endpoint.

**Using cURL:**
```bash
curl -X POST https://webhook-inspector-production-2c87.up.railway.app/catch/YOUR_ENDPOINT_ID \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":{"message":"Hello from terminal"}}'
```

**With validation rules:**
If you've defined validation rules, ensure your test payload includes the required fields.

## Rate Limits

- Webhook reception: 10 per minute per endpoint, 30 per minute per IP
- Endpoint generation: 5 per hour per user
- Webhook saves: 10 per minute per user
- Validation rule operations: 20 per minute per user
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP
- Test webhook button: 5 per minute (frontend only)

## Database Schema

- **users:** User accounts with email, password hash, and username
- **endpoints:** One endpoint per user with optional custom name
- **validation_rules:** Optional validation rules per endpoint
- **saved_webhooks:** Stored webhooks with validation status

All tables use UUID primary keys and proper foreign key constraints with cascading deletes.


## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and receive JWT token
- `GET /api/auth/me` - Verify current token

### Endpoints
- `POST /api/endpoints/generate` - Generate new webhook endpoint (requires auth)
- `GET /api/endpoints/my-endpoint` - Get current endpoint (requires auth)
- `PATCH /api/endpoints/name` - Update endpoint name (requires auth)

### Webhooks
- `POST /catch/:endpoint_id` - Receive webhook (public, rate limited)
- `GET /api/webhooks/saved/:endpoint_code` - Get saved webhooks
- `POST /api/webhooks/save` - Save webhook (requires auth, rate limited)
- `DELETE /api/webhooks/:id` - Delete saved webhook (requires auth)

### Validation Rules
- `GET /api/validation-rules` - Get validation rules (requires auth)
- `POST /api/validation-rules` - Create validation rule (requires auth, rate limited)
- `DELETE /api/validation-rules/:id` - Delete validation rule (requires auth, rate limited)

## License

MIT

## Author

Muhammad Rahman  
[GitHub](https://github.com/muhammadxrahman) | [LinkedIn](https://linkedin.com/in/rahmanm2016/)