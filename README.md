# 🎯 Webhook Inspector

A real-time webhook inspection tool for developers. Receive, inspect, and debug webhooks during development.

## Features

- 🚀 **Instant endpoint generation** - Get a public URL in one click
- ⚡ **Real-time updates** - See webhooks as they arrive via WebSockets
- 📦 **Complete inspection** - View headers, body, and timestamps
- 🧪 **Built-in testing** - Send test webhooks directly from the UI
- 💾 **Save functionality** - Persist important webhooks

## Tech Stack

**Frontend:**
- React
- Socket.IO Client
- Axios

**Backend:**
- Node.js + Express
- Socket.IO
- PostgreSQL

## Project Structure
webhook-inspector/
├── backend/          # Express + Socket.IO server
│   ├── server.js     # Main server file
│   ├── db.js         # Database configuration
│   └── package.json
├── frontend/         # React application
│   ├── src/
│   │   ├── App.js    # Main component
│   │   └── App.css   # Styles
│   └── package.json
└── README.md

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd webhook-inspector
```
2. Install backend dependencies:
```bash
cd backend
npm install
```
3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```
4. Set up environment variables:
Create backend/.env:
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/webhook_inspector
5. Start the backend:
```bash
cd backend
npm run dev
```
6. Start the frontend in another terminal:
```bash
cd frontend
npm start
```
7. Open http://localhost:3000