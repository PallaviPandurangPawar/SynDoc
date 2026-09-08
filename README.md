# SyncDoc — Collaborative Document Engine with AST Conflict Resolution

## Folder Structure

```
syncdoc/
├── backend/            Express + MongoDB + Socket.io + Yjs server
│   └── src/
│       ├── config/       DB connection, env loader
│       ├── models/       Mongoose schemas (Document, ASTNode, User)
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
