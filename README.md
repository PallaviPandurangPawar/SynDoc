# SyncDoc — Collaborative Document Engine with AST Conflict Resolution

## Folder Structure

```
syncdoc/
├── backend/            Express + MongoDB + Socket.io + Yjs server
│   └── src/
│       ├── config/       DB connection, env loader  ⟵ MongoDB connection lives here (db.js)
│       ├── models/       Mongoose schemas (Document, ASTNode, User)  ⟵ MongoDB collections/schemas defined here
│       ├── controllers/  REST route logic (AST, Document, Export)
│       ├── routes/       Express route definitions
│       ├── services/     CRDT, sync, transform, presence logic
│       ├── sockets/      Socket.io event handlers
│       ├── middlewares/  Sanitization, validation, error handling
│       └── utils/        AST->HTML, HTML->PDF helpers
│
├── frontend/           React + Vite client
│   └── src/
│       ├── components/   Editor, Presence, Export UI pieces
│       ├── hooks/        useYjsSync, useSocket, usePresence
│       ├── context/      DocumentContext (shared AST state)
│       ├── services/     Axios API wrapper
│       └── pages/        DocumentPage, Dashboard
│
└── package.json        Root convenience scripts
```

## Where's the database?

There's no separate "database" folder — this is standard practice for
Express/Mongoose projects. MongoDB-related code lives in two places instead:
- `backend/src/config/db.js` — the connection to MongoDB Atlas
- `backend/src/models/` — the Mongoose schemas that define your MongoDB
  collections (Document, ASTNode, User)

Any file that reads or writes data (mainly `services/documentService.js`)
also touches MongoDB indirectly through these models.

## Setup

```bash
npm run install:all
```

Then in two terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Backend runs on port 5000, frontend on port 5173.

## Status

This is scaffolding only — every file currently contains a `// TODO: implement`
comment marking its purpose. Code will be filled in week by week following the
4-week development plan (AST modeling → CRDT integration → transformation
pipeline → security hardening).
