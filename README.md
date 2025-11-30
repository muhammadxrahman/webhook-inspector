# Webhook Inspector

**Live Site:** https://webhook-inspector-nine.vercel.app/

A real-time webhook inspection tool for developers. Receive, inspect, and debug webhooks during development with persistent storage and user authentication.

## Features

- Real-time webhook reception and display via WebSockets
- User authentication with secure JWT tokens
- Persistent webhook storage (save up to 10 per endpoint)
- One endpoint per user with instant generation
- Comprehensive rate limiting on all routes
- Full request inspection (headers, body, timestamps)
- Built-in test webhook functionality
- Webhook validation rules for header and body keys

## Tech Stack

**Frontend:** React, Socket.IO Client, Axios  
**Backend:** Node.js, Express, Socket.IO, PostgreSQL  
**Deployment:** Vercel (frontend), Railway (backend + database)

## Project Structure
```
webhook-inspector/
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── routes/
│   ├── middleware/
│   └── utils/
├── frontend/
│   └── src/
│       ├── App.js
│       ├── Auth.js
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
4. Start services:
```bash
# Terminal 1 - Backend
cd backend && npm run dev
# Terminal 2 - Frontend
cd frontend && npm start
```
5. Open http://localhost:3000

## Usage

1. Register an account or log in
2. Generate your unique webhook endpoint
3. Configure third-party services (GitHub, Stripe, etc.) to send webhooks to your endpoint
4. View incoming webhooks in real-time
5. Save important webhooks for later reference
6. Delete saved webhooks as needed

**Testing with cURL:**
```bash
curl -X POST https://webhook-inspector-production-2c87.up.railway.app/catch/YOUR_ENDPOINT_ID \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Rate Limits

- Webhook reception: 10 requests/min per endpoint
- Endpoint generation: 5 per hour per user
- Webhook saves: 10 per minute per user
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP

## License

MIT
