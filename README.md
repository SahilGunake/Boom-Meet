# Boom Meet

Video conferencing application built with **React + Vite** (frontend), **Express** (API), **Socket.IO** (signaling), and **PeerJS/WebRTC** (media).

## Tech Stack

| Layer       | Technology                                      |
| ----------- | ----------------------------------------------- |
| Frontend    | React 18, Vite, React Router, Bootstrap 5       |
| Backend     | Express.js, Passport.js (local auth), Socket.IO |
| Database    | Firebase Firestore (Admin SDK)                  |
| WebRTC      | PeerJS (client + ExpressPeerServer)              |
| Security    | Helmet, CORS, bcrypt, rate limiting, DOMPurify  |

## Project Structure

```
Boom-Meet/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/        Landing, Login, Register, Dashboard, Room
│   │   ├── components/   VideoPlayer, ChatPanel, MeetingControls
│   │   ├── context/      AuthContext
│   │   └── styles/       CSS
│   └── vite.config.js    Dev proxy → backend
├── server/          # Express API backend
│   ├── config/           DB, Passport
│   ├── middleware/        Auth guard, Rate limiter
│   ├── models/           User (Firestore)
│   ├── routes/           /api/auth, /api/meetings
│   └── server.js         Entry point
├── .env             # Secrets (not committed)
└── package.json     # Workspace scripts
```

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd Boom-Meet
npm install            # installs concurrently
npm run install-all    # installs server + client deps
```

### 2. Configure environment

Create a `.env` file in the project root:

```
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END RSA PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
SESSION_SECRET=<random-64-char-hex>
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

To get these values, go to **Firebase Console → Project Settings → Service Accounts → Generate new private key**, and copy the corresponding fields from the downloaded JSON.

### 3. Run development servers

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend** → http://localhost:5173 (Vite dev server)
- **Backend**  → http://localhost:5000 (Express API)

Vite proxies `/api`, `/socket.io`, and `/peerjs` requests to the backend automatically.

## Features

- User registration & login (Passport.js local strategy)
- Create instant meetings with unique room IDs
- Join meetings via room code
- Real-time video & audio (WebRTC via PeerJS)
- Audio mute/unmute & video on/off toggles
- In-meeting text chat (Socket.IO) with XSS protection
- Responsive layout (desktop + mobile)
- Security: Helmet headers, rate limiting, bcrypt password hashing, session-based auth
