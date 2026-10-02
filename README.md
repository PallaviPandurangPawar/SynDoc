# SyncDoc — Collaborative Document Engine with AST Conflict Resolution

SyncDoc is a real-time collaborative document editor. Several users can edit the same document at the same time without overwriting each other's work. Documents are stored as a tree of blocks (an Abstract Syntax Tree, or AST), and edits are merged character by character with a CRDT (Yjs).

## Features

- **Real-time collaboration** — Yjs (CRDT) over a WebSocket, with Socket.io as an automatic backup route. Two people can type in the same block at once and both edits are kept.
- **Block-based editor** — headings, paragraphs, code blocks, lists (bullet, numbered, checklist), quotes, callouts, images and dividers
- **Block locking** — a block is locked while someone edits it, so layouts are never overwritten
- **Live presence and cursors** — see who is in the document, which block they are in, and their exact cursor and selection (in their own colour)
- **AST database** — nested document nodes in MongoDB, with pre-save validation, change tracking and version history
- **Accounts** — sign up with email verification (6-digit OTP), sign in with Google, forgot / reset password
- **Collaboration by room code** — share a code; the owner approves join requests
- **Profile, trash, collaborators** — manage your account, restore deleted documents, add or remove people
- **Export** — download a document as PDF, HTML or Markdown
- **Light and dark theme**

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Axios |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Real-time | Yjs (CRDT), y-websocket, Socket.io |
| Email | Nodemailer (Gmail) |
| Security | JWT, bcrypt, DOMPurify |
| Export | Puppeteer (PDF) |

## How It Works

1. Every block is a Yjs map; its text is a `Y.Text`, so only the typed characters travel over the network.
2. The editor connects to the server through the **Yjs WebSocket** (`/yjs/<documentId>`). If that is unavailable, it falls back to **Socket.io** automatically. Both feed the same document, so they cannot disagree. The toolbar shows which route is active.
3. The server keeps the live document, saves it to MongoDB a moment after each change (and immediately when the last person leaves), and sends it to anyone who joins.
4. Presence (who is here, cursors, selections) and block locks travel over Socket.io.
5. Export turns the AST into HTML (sanitized with DOMPurify) and optionally into a PDF.

## Folder Structure

```
SynDoc/
├── backend/              Express + MongoDB + Socket.io + Yjs server
│   ├── server.js         Entry point
│   ├── test*.js          Automated checks (see Testing)
│   └── src/
│       ├── config/       Database connection, env loader, CORS rules
│       ├── models/       Mongoose schemas (User, Document, ASTNode)
│       ├── controllers/  Route logic (auth, users, documents, AST, export)
│       ├── routes/       Express route definitions
│       ├── services/     CRDT, sync, presence, locks, transform, email
│       ├── sockets/      Socket.io and Yjs WebSocket handlers
│       ├── middlewares/  Auth, access control, AST validation, sanitizing
│       └── utils/        AST to HTML, HTML to PDF, Markdown to AST
│
├── frontend/             React + Vite client
│   └── src/
│       ├── components/   Editor (Block, TextField, Toolbar), Presence, Layout, Loader
│       ├── hooks/        useYjsSync, useSocket, usePresence, useLocks
│       ├── lib/          Block and cursor helpers (with their own tests)
│       ├── context/      Auth, Document (active block and cursor) and Theme state
│       ├── services/     Axios API wrapper
│       └── pages/        Login, Register, ResetPassword, Dashboard, DocumentPage, Trash, Profile
│
├── docs/                 Markdown-to-AST specification
└── package.json          Root convenience scripts
```

## Setup

### 1. Install

```bash
npm run install:all
```

### 2. Create `backend/.env`

Create a file named `.env` inside the `backend/` folder (see `backend/.env.example`):

```
PORT=5000
MONGO_URI=<your MongoDB connection string>
CLIENT_URL=http://localhost:5173
JWT_SECRET=<a random string of at least 32 characters>
EMAIL_USER=<gmail address that sends the emails>
EMAIL_PASS=<16-character Google App Password>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Generate a strong `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server **refuses to start** if `JWT_SECRET` is missing, shorter than 32 characters, or a known example value. `.env` is listed in `.gitignore`. Never commit it or share it.

### 3. Create `frontend/.env`

```
VITE_GOOGLE_CLIENT_ID=<the same Google client ID>
```

Optional, only when the backend runs at a different address than the website: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_WS_URL` (see `frontend/src/config.js`).

### 4. Google App Password (for emails)

1. Turn on 2-Step Verification at `myaccount.google.com/security`.
2. Open `myaccount.google.com/apppasswords`.
3. Enter an app name (for example `SyncDoc`) and click **Create**.
4. Copy the 16-character password into `EMAIL_PASS`, without spaces.

### 5. Google sign-in

1. In Google Cloud Console, create an OAuth client ID of type **Web application**.
2. Add `http://localhost:5173` as an authorized JavaScript origin.
3. Put the client ID in both `.env` files and the client secret in `backend/.env`.

### 6. Run

Open two terminals in the `SynDoc` folder:

```bash
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://localhost:5000` (health check at `/health`)
- Frontend: `http://localhost:5173`

## Accounts

**Sign up with email verification**
1. The user enters name, email and password.
2. The backend creates an unverified account and emails a 6-digit code.
3. A correct code verifies the account and logs the user in.

- The code is stored hashed and expires after 10 minutes
- 5 wrong attempts are allowed per code
- A new code can be requested once every 60 seconds
- Unverified accounts cannot log in

**Forgot password**
- The user requests a reset link by email; the link is valid for 1 hour
- One reset email per minute per account

**Google sign-in** creates or signs in the account from the Google profile.

## API Overview

All routes except `/api/auth/*` require an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/verify-otp`, `/resend-otp`, `/login`, `/google`, `/forgot-password`, `/reset-password` |
| Profile | `GET /api/users/me`, `PUT /api/users/me` |
| Documents | `GET/POST /api/documents`, `GET/PUT/PATCH/DELETE /api/documents/:id`, `/search`, `/stats`, `/trash` |
| Document actions | `PATCH /:id/restore`, `DELETE /:id/permanent`, `POST /:id/duplicate`, `GET /:id/history`, `GET /:id/locks` |
| Collaborators | `POST /:id/collaborators`, `DELETE /:id/collaborators/:userId` |
| Room codes | `GET /:id/room-code`, `POST /:id/room-code/regenerate`, `PATCH /:id/room-code/toggle`, `POST /join`, `GET /:id/join-requests`, approve / reject |
| AST | `/api/documents/:id/ast` (get, history, insert, update, delete and move nodes) |
| Export | `GET /api/documents/:id/export/pdf`, `/html`, `/markdown` |

Real-time:
- **Yjs WebSocket:** `ws://<host>/yjs/<documentId>?token=<jwt>`
- **Socket.io events:** `join-document`, `sync-update`, `presence-join`, `presence-cursor`, `presence-update`, `lock-block`, `unlock-block`, `lock-update`

## Security

- **Login required everywhere:** the REST API, Socket.io and the Yjs WebSocket all check the JWT and the user's access to the document. A wrong token is refused.
- **Content is cleaned before it is saved:** every block is passed through DOMPurify rules on the way into MongoDB. Script tags, event handlers and `javascript:` links are removed from text, captions and image / link addresses. Code blocks are kept exactly as typed because they are always escaped. Export is sanitized again.
- **Strong secret required:** the server will not start with a weak or missing `JWT_SECRET`.
- **CORS is restricted** to `CLIENT_URL` (any local port is also allowed while `NODE_ENV` is not `production`). Set `NODE_ENV=production` when deploying.
- **Presence data is validated:** names, colours and cursor positions sent by clients are cleaned by the server.

## Testing

Run these from the `backend/` folder.

**Checks that need no server and no database**

```bash
npm run test:offline
```

Covers saved-block sanitizing, character-level (`Y.Text`) merging on the server, delta tracking, the AST schema, and the Markdown-to-AST mapping (65 checks).

**Checks against the running system** (start the backend first with `npm run dev`; MongoDB must be reachable)

```bash
npm run test:live
```

| Script | What it proves |
|---|---|
| `testStress.js` | 10 concurrent clients add blocks at once; none is lost, all are saved |
| `testSanitizeSave.js` | A block with `<script>` and a `javascript:` link is stored clean |
| `testYjsWebSocket.js` | The WebSocket needs a valid token, merges two people typing in the same block, saves, and shares one document with Socket.io |
| `testPresenceCursor.js` | Cursors and selections arrive, fast movement is throttled but the last position is delivered, bad data is cleaned |
| `testLock.js` | Locks are visible to everyone, refused to a second person, released on unlock and on disconnect |

Frontend (from `frontend/`):

```bash
npm run test:yblocks    # block text merging, concurrent edits, offline edits
npm run test:cursor     # cursor and selection helpers
```

Other scripts: `verify_transformation.js` (AST to HTML and PDF; needs Chrome for the PDF step), `test_document_crud.js`.

## Project Plan Coverage

| Plan item | Where |
|---|---|
| Week 1 — AST modeling, recursive pre-save hooks | `models/ASTNode.js`, `models/Document.js`, `middlewares/validateAST.js` |
| Week 1 — Editor foundations (block-level rendering) | `components/Editor/Block.jsx` (8 block types) |
| Week 2 — CRDT integration, block locking | `services/crdtService.js`, `sockets/websocket.js`, `services/lockService.js` |
| Week 2 — Connect client to Yjs WebSocket, presence | `hooks/useYjsSync.js`, `hooks/usePresence.js` |
| Mid review — layout diagrams, 10-client stress test | `docs/MARKDOWN_TO_JSON_SPEC.md`, `testStress.js` |
| Mid review — delta tracking | `lib/yBlocks.js`, `testDeltaTracking.js`, `test:yblocks` |
| Week 3 — Transformation engine (AST to HTML / PDF / Markdown) | `utils/astToHtml.js`, `utils/htmlToPdf.js`, `utils/markdownToAst.js` |
| Week 3 — Cursor positions and selection bounds | `context/DocumentContext.jsx`, `components/Presence/CursorOverlay.jsx`, `sockets/presenceHandler.js` |
| Week 4 — DOMPurify security controls | `middlewares/sanitize.js`, `models/Document.js` (pre-save), `services/documentService.js` |
| Week 4 — Visual block state indicators, synced cursors | lock badges and live cursors in the editor |

## Documentation

See `docs/MARKDOWN_TO_JSON_SPEC.md` for how Markdown maps to the AST JSON model.