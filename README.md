# SyncDoc — Collaborative Document Engine with AST Conflict Resolution

SyncDoc is a real-time collaborative document editor. Several users can edit the same document at the same time without overwriting each other's work. Documents are stored as a tree of blocks (an Abstract Syntax Tree, or AST), and edits are merged with a CRDT (Yjs).

## Features

- **Real-time collaboration** — live editing over Socket.io with Yjs (CRDT), so simultaneous edits merge automatically
- **Block-based editor** — headings, paragraphs, code blocks, lists, quotes, images, dividers and callouts
- **Block locking** — a block is locked while someone edits it, so layouts are never overwritten
- **Live presence** — see who is in the document and where their cursor is
- **AST database** — nested document nodes in MongoDB, with pre-save validation, change tracking and version history
- **Accounts with email verification** — sign up with name, email and password, then confirm with a 6-digit OTP sent to your email
- **Profile** — name, address, phone, about and a profile photo
- **Trash** — deleted documents can be restored or deleted permanently
- **Collaborators** — the owner can add or remove people on a document
- **Export** — download a document as PDF, HTML or Markdown (HTML is sanitized with DOMPurify)
- **Light and dark theme**

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Axios |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Real-time | Socket.io, Yjs, y-websocket |
| Email | Nodemailer (Gmail) |
| Security | JWT, bcrypt, DOMPurify |
| Export | Puppeteer (PDF) |

## Folder Structure

```
SynDoc/
├── backend/              Express + MongoDB + Socket.io + Yjs server
│   ├── server.js         Entry point
│   └── src/
│       ├── config/       Database connection, env loader
│       ├── models/       Mongoose schemas (User, Document, ASTNode)
│       ├── controllers/  Route logic (auth, users, documents, AST, export)
│       ├── routes/       Express route definitions
│       ├── services/     CRDT, sync, presence, locks, transform, email
│       ├── sockets/      Socket.io and WebSocket handlers
│       ├── middlewares/  Auth, access control, AST validation, sanitizing
│       └── utils/        AST to HTML, HTML to PDF, Markdown to AST
│
├── frontend/             React + Vite client
│   └── src/
│       ├── components/   Editor, Presence, Layout, Export, Loader
│       ├── hooks/        useYjsSync, useSocket, usePresence, useLocks
│       ├── context/      Auth, Document and Theme state
│       ├── services/     Axios API wrapper
│       └── pages/        Login, Register, Dashboard, DocumentPage, Trash, Profile
│
├── docs/                 Markdown-to-AST specification
└── package.json          Root convenience scripts
```

MongoDB code lives in `backend/src/config/db.js` (connection) and `backend/src/models/` (schemas).

## Setup

### 1. Install

```bash
npm run install:all
```

### 2. Create `backend/.env`

Create a file named `.env` inside the `backend/` folder:

```
PORT=5000
MONGO_URI=<your MongoDB connection string>
CLIENT_URL=http://localhost:5173
JWT_SECRET=<any long random string>
EMAIL_USER=<gmail address that sends the OTP emails>
EMAIL_PASS=<16-character Google App Password>
```

This file is listed in `.gitignore`. Never commit it or share it.

### 3. Create a Google App Password (for OTP emails)

1. Turn on 2-Step Verification at `myaccount.google.com/security`.
2. Open `myaccount.google.com/apppasswords`.
3. Enter an app name (for example `SyncDoc`) and click **Create**.
4. Copy the 16-character password into `EMAIL_PASS`, without spaces.

Each developer should create their own App Password.

### 4. Run

Open two terminals in the `SynDoc` folder:

```bash
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://localhost:5000` (health check at `/health`)
- Frontend: `http://localhost:5173`

## Sign Up and Email Verification

1. The user enters name, email and password on the Sign Up page.
2. The backend creates the account as unverified and emails a 6-digit code.
3. The user enters the code on the same page.
4. A correct code verifies the account and logs the user in.

Rules:
- The code is stored hashed and expires after 10 minutes
- 5 wrong attempts are allowed per code
- A new code can be requested once every 60 seconds
- Unverified accounts cannot log in

## API Overview

All routes except `/api/auth/*` require an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/verify-otp`, `/resend-otp`, `/login` |
| Profile | `GET /api/users/me`, `PUT /api/users/me` |
| Documents | `GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/:id`, `/search`, `/stats`, `/trash` |
| Document actions | `PATCH /:id/restore`, `DELETE /:id/permanent`, `POST /:id/duplicate`, `GET /:id/history`, `GET /:id/locks` |
| Collaborators | `POST /:id/collaborators`, `DELETE /:id/collaborators/:userId` |
| AST | `/api/documents/:id/ast` (get, history, insert, update, delete and move nodes) |
| Export | `GET /api/documents/:id/export/pdf`, `/html`, `/markdown` |

Real-time events use Socket.io: `join-document`, `sync-update`, `presence-join`, `presence-cursor`, `lock-block` and `unlock-block`.

## Testing

Manual test scripts are in the `backend/` folder (`testStress.js`, `testPersistence.js`, `testLock.js`, `testPresence.js`, `testExportPhase1.js` and others). Run one with `node <file>` from inside `backend/` while the server is running.

## Documentation

See `docs/MARKDOWN_TO_JSON_SPEC.md` for how Markdown maps to the AST JSON model.