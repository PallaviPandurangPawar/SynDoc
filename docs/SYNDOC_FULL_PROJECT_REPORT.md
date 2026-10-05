# SynDoc — Collaborative Document Engine with AST Conflict Resolution
## Comprehensive Engineering & Architecture Project Report (A to Z)
**Project Title:** SynDoc — Real-Time Collaborative Document Engine with AST Conflict Resolution  
**Document Version:** 1.0.0 (Production / Final Submission)  
**Date:** October 2026  
**Confidentiality:** Internal / Project Evaluation Submission  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Project Scope & Problem Statement](#2-project-scope--problem-statement)
3. [Technology Stack & Architectural Overview](#3-technology-stack--architectural-overview)
4. [Abstract Syntax Tree (AST) & Document Data Modeling](#4-abstract-syntax-tree-ast--document-data-modeling)
5. [Real-Time Synchronization Layer & CRDT Engine](#5-real-time-synchronization-layer--crdt-engine)
6. [Presence & Distributed Block-Level Locking](#6-presence--distributed-block-level-locking)
7. [Security Hardening & Zero-Trust Persistence Controls](#7-security-hardening--zero-trust-persistence-controls)
8. [Multi-Format Transformation & Export Pipeline](#8-multi-format-transformation--export-pipeline)
9. [Authentication, Authorization & Access Delegation](#9-authentication-authorization--access-delegation)
10. [Quality Assurance, Testing & Stress Verification](#10-quality-assurance-testing--stress-verification)
11. [Project Execution Timeline & Milestone Coverage](#11-project-execution-timeline--milestone-coverage)
12. [Deployment, Infrastructure & Operational Runbook](#12-deployment-infrastructure--operational-runbook)
13. [Conclusion & Future Roadmap](#13-conclusion--future-roadmap)

---

## 1. Executive Summary

**SynDoc** is an enterprise-grade real-time collaborative document processing platform engineered to eliminate data corruption, race conditions, and destructive overwrites in multi-user document authoring environments. Traditional web-based document editors frequently rely on naive Last-Write-Wins (LWW) locking or monolithic text blob replacement, leading to lost edits, broken block structures, and poor network resilience.

SynDoc resolves these fundamental limitations by unifying a **Recursive Abstract Syntax Tree (AST)** document model with a **Conflict-Free Replicated Data Type (CRDT)** synchronization engine powered by **Yjs**. The system features:
- **Dual-Layer Granular Synchronization:** Block-level structure is tracked as a `Y.Array` of `Y.Map` blocks, while character-level modifications within blocks are processed via `Y.Text` delta-tracking algorithms (Logoot/YATA).
- **Zero-Overwrite Replication Matrix:** Commutative and associative operations guarantee Strong Eventual Consistency (SEC) across concurrent collaborators without requiring centralized locking for content merges.
- **Failover Dual-Transport Network:** An active-active real-time transport with native WebSockets (`y-websocket`) bridged seamlessly with a Socket.io fallback transport.
- **Multi-Tiered Security Hardening:** Comprehensive DOMPurify sanitization guards against persistent Cross-Site Scripting (XSS) at runtime and database pre-save hooks, complemented by cryptographic JWT verification and OAuth 2.0 PKCE authentication.
- **High-Fidelity Document Export:** Puppeteer-powered headless PDF generation and AST-to-Markdown/HTML bi-directional serialization.

---

## 2. Project Scope & Problem Statement

### 2.1 The Problem Space
Collaborative rich-text platforms (such as Google Docs, Notion, or Confluence) face three primary distributed systems challenges:
1. **Destructive Overwrites (LWW Race Conditions):** When two or more remote workers modify adjacent paragraphs or even the same sentence simultaneously, HTTP REST updates or uncoordinated WebSocket broadcasts frequently overwrite earlier commits.
2. **Structural Fragility:** In hierarchical document models (nesting headings, bullet lists, checklist blocks, callouts, and code blocks), concurrent modifications to parent-child nodes often break layout trees, introducing circular references or orphan child nodes.
3. **Security Ingestion Vulnerabilities (Stored XSS):** Collaborative tools allow arbitrary rich-text, code snippets, links, and media inputs. Malicious actors can inject `<script>` tags, SVG payloads, event handlers (`onerror`, `onload`), or `javascript:` URI protocols into shared documents.

### 2.2 SynDoc Solution Architecture
SynDoc addresses these issues via a modular, multi-tier architecture:
- **Block-Based AST Model:** Documents are broken down into discrete typed blocks (`heading`, `paragraph`, `code`, `list`, `blockquote`, `image`, `divider`, `callout`).
- **CRDT Concurrency:** Merging occurs automatically at mathematical convergence boundaries using Lamport timestamps and unique client IDs.
- **Zero-Trust Pre-Save Sanitization:** All incoming mutations undergo deep attribute whitelisting, entity-safe DOMPurify plain-text normalization, and protocol verification before persisting to MongoDB.

---

## 3. Technology Stack & Architectural Overview

### 3.1 Technology Matrix

| Layer | Component | Version | Role in Architecture |
|---|---|---|---|
| **Frontend** | React | 18.2.0 | Reactive component rendering, block layout state |
| | Vite | 5.4.x | Next-generation build tool, HMR dev environment |
| | React Router | 6.26.x | Client-side routing with v7 future flag compliance |
| | Axios | 1.7.x | Interceptor-based REST communication |
| | @react-oauth/google | 0.12.x | Identity Services client-side Google sign-in |
| **Backend** | Node.js | v20.x LTS | Server runtime environment |
| | Express | 4.19.x | RESTful API routing and middleware pipeline |
| | Mongoose | 8.5.x | MongoDB ODM with recursive schema hooks |
| | MongoDB Atlas | 7.x | Cloud document database with text indexing |
| **Real-Time** | Yjs | 13.6.x | Shared CRDT state engine and binary encoder |
| | y-websocket | 2.0.x | Ultra-low-latency WebSocket real-time transport |
| | Socket.io | 4.7.x | Presence, cursor broadcast, fallback sync channel |
| **Security** | DOMPurify / JSDOM | 3.1.x / 24.1.x | Server-side HTML and attribute sanitization engine |
| | bcryptjs | 3.0.x | Password and OTP salted hashing |
| | jsonwebtoken | 9.0.x | Stateless Bearer token cryptographic authentication |
| **Export/Email** | Puppeteer | 22.13.x | Headless Chromium engine for pixel-perfect PDF export |
| | Nodemailer | 10.0.x | SMTP email transport for OTP verification and alerts |

### 3.2 High-Level System Architecture Diagram

```
                                  ┌───────────────────────────────┐
                                  │      Client Web Browser       │
                                  │  React 18 + Vite Single Page  │
                                  └───────┬───────────────┬───────┘
                                          │               │
                             HTTP / REST  │               │ WebSocket / Socket.io
                              (Port 5000) │               │ (Dual Realtime Bridge)
                                          │               │
                                          ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SynDoc Node.js / Express Core                         │
│                                                                                 │
│   ┌────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐   │
│   │  Auth & User API   │   │  Document & AST API  │   │ Export Engine       │   │
│   │  (JWT/Bcrypt/OTP)  │   │  (CRUD/History/Room) │   │ (HTML / PDF Puppt.) │   │
│   └─────────┬──────────┘   └──────────┬───────────┘   └──────────┬──────────┘   │
│             │                         │                          │              │
│   ┌─────────▼─────────────────────────▼──────────────────────────▼──────────┐   │
│   │                  Security & Validation Middleware Pipeline              │   │
│   │     • JWT Auth Guard  • validateASTStructure  • DOMPurify Sanitizer    │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       │                                         │
│   ┌───────────────────────────────────▼─────────────────────────────────────┐   │
│   │                      Real-Time Synchronization Layer                    │   │
│   │   ┌────────────────────────┐              ┌─────────────────────────┐   │   │
│   │   │  y-websocket Provider  │◄────────────►│  Socket.io Sync Handler │   │   │
│   │   └───────────┬────────────┘  Sync Bridge └───────────┬─────────────┘   │   │
│   │               │                                       │                 │   │
│   │               ▼                                       ▼                 │   │
│   │   ┌─────────────────────────────────────────────────────────────┐       │   │
│   │   │      In-Memory CRDT Service (Y.Doc Pool & State Cache)       │       │   │
│   │   └───────────────────────────────┬─────────────────────────────┘       │   │
│   │                                   │                                     │   │
│   │               Debounced Persistence (2000ms) / Disconnect Flush         │   │
│   │                                   ▼                                     │   │
│   │   ┌─────────────────────────────────────────────────────────────┐       │   │
│   │   │   Mongoose Pre-Save Lifecycle (Metrics, Diff, Sanitization) │       │   │
│   │   └───────────────────────────────┬─────────────────────────────┘       │   │
│   └───────────────────────────────────┼─────────────────────────────────────┘   │
│                                       │                                         │
└───────────────────────────────────────┼─────────────────────────────────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │    MongoDB Atlas Cluster    │
                         │  (Documents, Users, Nodes)  │
                         └─────────────────────────────┘
```

---

## 4. Abstract Syntax Tree (AST) & Document Data Modeling

### 4.1 AST Schema Architecture
Rather than storing documents as unstructured HTML strings or unparsed Markdown, SynDoc organizes documents as hierarchical, validated Abstract Syntax Trees.

Each document is structured using `ASTNodeSchema` (`backend/src/models/ASTNode.js`):
- `nodeId`: Globally unique identifier (`UUIDv4`) attached to each block.
- `type`: Strict enumeration: `'root'`, `'paragraph'`, `'heading'`, `'code'`, `'blockquote'`, `'list'`, `'listItem'`, `'text'`, `'image'`, `'divider'`, `'callout'`.
- `content`: Primary text payload of the node.
- `attributes`: Flexible key-value metadata dictionary containing:
  - `level`: Heading level (`1`–`6`).
  - `listType`: Type of list (`'bullet'`, `'ordered'`, `'check'`).
  - `checked`: Boolean task completion indicator for checklist blocks.
  - `language`: Normalized syntax highlighting identifier for code blocks.
  - `src`, `alt`, `caption`: Image attributes.
  - `bold`, `italic`, `code`, `strikethrough`, `link`, `href`: Inline markup flags.
- `children`: Recursive array of child `ASTNodeSchema` objects enabling arbitrary nesting.

### 4.2 Structural Validation & Circular Reference Protection
The `calculateASTMetrics` and `validateASTStructure` engines (`backend/src/models/Document.js` & `backend/src/middlewares/validateAST.js`) run recursively prior to document persistence:
1. **Circular Reference Detection:** Tracks all visited `nodeId` references in a traversal `Set`. If an identifier appears twice within an ancestry path, the transaction is rejected.
2. **Depth Throttling:** Enforces a hard recursion limit (`MAX_DEPTH = 50`) to safeguard Node.js call stacks from stack overflow attacks.
3. **Metric Calculation:** Recursively computes live document statistics:
   - `nodeCount`: Total active nodes across all tree levels.
   - `wordCount`: Text tokens computed across all constituent nodes.
   - `depth`: Maximum depth of the leaf elements.

### 4.3 Automated Pre-Save Change Auditing & Granular Diff Tracking
Every modification stored in MongoDB executes `preSaveDocument`:
- Computes an AST structural difference snapshot (`computeASTStructuralDiff`) comparing the baseline `_originalAst` against the new AST.
- Tracks exact arrays of:
  - `insertedNodes`: Added nodes with assigned parent IDs.
  - `deletedNodes`: Removed nodes.
  - `movedNodes`: Nodes re-indexed or reparented.
  - `modifiedNodes`: Nodes where text, formatting, or node types changed.
- Increments the document `version` counter and stores an immutable audit record in `changeHistory` (capped at the 50 most recent edits to manage document BSON size).

---

## 5. Real-Time Synchronization Layer & CRDT Engine

### 5.1 The CRDT Mathematical Model
SynDoc utilizes **Yjs**, a conflict-free replicated data type implementation based on the YATA (Yet Another Transformation Approach) sequence CRDT algorithm.

```
Concurrent Edit Scenario:
Peer 1 types "A" at pos 0            Peer 2 types "B" at pos 0
Client ID: 1042, Clock: 1            Client ID: 8912, Clock: 1
               \                              /
                \                            /
                 ▼                          ▼
           [Block State Vector Integration Matrix]
      Deterministic Total Order: (Clock_i, ClientID_i)
                         Result: "AB"
          (Zero data loss, zero overwrite, SEC achieved)
```

1. **State Vectors:** Every client and the central server maintain a state vector summarizing the sequence numbers (Lamport clocks) observed from every collaborating client:
   $$\mathcal{V} = \{ \text{client}_1: \text{clock}_1, \text{client}_2: \text{clock}_2, \dots, \text{client}_n: \text{clock}_n \}$$
2. **Delta Encoding:** When an edit occurs, only the state delta (`Y.encodeStateAsUpdate(yDoc, targetVector)`) is serialized into an optimized binary array and broadcast over the wire.
3. **Commutative Merges:** Updates can arrive out of order, be retried, or be received after reconnection; Yjs guarantees that mathematical integration produces the exact same document across all peers.

### 5.2 Zero-Overwrite Data Replication Matrix
To eliminate overwrites:
1. **Outer Replication Matrix (`Y.Array<Y.Map>`):** Top-level document structure is an array of maps. Inserting or removing a block sends index operations keyed by unique `nodeId`. Two users adding blocks at identical positions have their blocks deterministically ordered rather than overwriting each other.
2. **Inner Character Replication Matrix (`Y.Text`):**
   - Implemented in `frontend/src/lib/yBlocks.js` via `applyTextDiff()`.
   - Compares the current local DOM input against the underlying `Y.Text` using two-pointer head/tail string diffing.
   - Preserves surrogate pairs (preventing emoji corruption).
   - Only the specific deleted or inserted slice is mutated on the `Y.Text`.
   - **Outcome:** When User A fixes a typo at index 3 and User B adds words at index 25 in the same paragraph simultaneously, both edits merge flawlessly.

### 5.3 Dual-Transport Real-Time Architecture
SynDoc provides resilient network replication by bridging two protocols:

1. **Native Yjs WebSocket (`y-websocket`):** Primary ultra-fast binary transport (`ws://localhost:5000/yjs/:documentId?token=JWT`). Performs direct zero-copy binary state exchange.
2. **Socket.io Fallback Transport:** Secondary transport with automatic HTTP long-polling fallback, presence, and lock orchestration.
3. **Bi-Directional Internal Bridge (`backend/src/sockets/syncHandler.js`):**
   When an update is received via Socket.io, it is applied to the authoritative in-memory `Y.Doc` and immediately forwarded to any clients connected to the same document via `y-websocket` (`Y.applyUpdate(wsDoc, updateBytes, 'socket-io')`), guaranteeing complete synchronization parity across heterogeneous client connections.

### 5.4 Persistence Lifecycle & Memory Management
- **Debounced Flush (`DEBOUNCE_MS = 2000`):** Fast keystrokes are batched in memory. An idle period of 2 seconds triggers a database snapshot.
- **Synchronous Disconnect Flush (`persistNow`):** When the last active socket departs a document room, any pending debounce timers are immediately cleared and the document is synchronously persisted to MongoDB.
- **Dual Representation Parity:** The persistence pipeline updates both `content` (array representation) and `ast.children` (tree representation) simultaneously via `patchDocumentContent`, preventing schema divergence between real-time socket sessions and REST API endpoints.
- **TTL Eviction (`evictIdleDocs`):** An automated background timer sweeps in-memory `Y.Doc` instances every 5 minutes. Documents idle for >10 minutes with zero connected sockets are purged from memory, preventing memory leaks on long-running servers.

---

## 6. Presence & Distributed Block-Level Locking

### 6.1 Block-Level Locking (Distributed Mutual Exclusion)
While text edits within a block merge seamlessly via CRDT, structural re-typing or deletion of active blocks requires coordination to avoid disorientation:
- Implemented in `backend/src/services/lockService.js` and `backend/src/sockets/lockHandler.js`.
- A collaborator acquires an exclusive lock on a block via `lock-block { documentId, blockId }`.
- Other clients display an amber lock badge indicating the block is currently owned by the named collaborator, preventing conflicting reformatting.
- **Auto-Release Safeguards:**
  - Locks feature a 30-minute hard TTL.
  - If a user disconnects or closes their tab, the `disconnect` handler queries all active locks owned by that socket across all documents and broadcasts immediate unlock events (`lock-update`).

### 6.2 Real-Time Presence & Synced Cursors
- Managed via `backend/src/sockets/presenceHandler.js` and rendered by `frontend/src/components/Presence/CursorOverlay.jsx`.
- **Throttling & Smoothing:** Cursor coordinate broadcasts (`presence-cursor`) are throttled at 50ms intervals, while a trailing timer guarantees that the final resting cursor position is always delivered.
- **Visual Feedback:** Each collaborator is assigned a consistent HSL-derived profile color. Cursors display real-time usernames, active block IDs, and selection boundary ranges.
- **Sanitization:** All presence payloads (user names, colors, and coordinates) are strictly validated on the server to prevent malicious injection via socket payloads.

---

## 7. Security Hardening & Zero-Trust Persistence Controls

### 7.1 DOMPurify XSS Hardening Suite
SynDoc implements a defense-in-depth model guarding against Cross-Site Scripting (XSS) across all text inputs:

```
[Untrusted Client Payload]
          │
          ▼
1. Plain-Text Normalization (toPlainText)
   • DOMPurify with ALLOWED_TAGS: [] & ALLOWED_ATTR: []
   • Strips <script>, <style>, <svg>, <math>, and malicious HTML tags
   • Decodes entities to preserve mathematical (<, >) and text symbols
          │
          ▼
2. Strict Attribute Filtering (sanitizeAttributes)
   • Links / URLs: Enforces SAFE_LINK regex:
     /^(https?:|mailto:|tel:|#|\/(?!\/))/i
     -> Blocks javascript:, data:text/html, vbscript:
   • Media Sources: Enforces SAFE_IMAGE regex:
     /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);base64,)/i
     -> Blocks SVG scripts and non-image data URIs
   • Metadata Attributes: alt, caption, title, label sanitized via toPlainText
   • Code Languages: Enforces SAFE_LANGUAGE regex: /^[a-z0-9+#._-]{1,30}$/
   • Inline Event Handler Stripping: Deletes any on* attribute keys (onerror, onclick)
          │
          ▼
3. Recursive Subdocument Pre-Save Hook (DocumentSchema.pre('save'))
   • Traverses doc.content and doc.ast in-place before persisting to MongoDB
          │
          ▼
[Sanitized, Safe Database Storage]
```

### 7.2 SSRF Protection on Image Export
The transformation pipeline (`backend/src/utils/htmlToPdf.js`) downloads external images to embed them as base64 data URIs for self-contained export. To prevent Server-Side Request Forgery (SSRF):
- Rejects requests to `localhost`, `127.0.0.1`, `::1`, and private IP subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Blocks cloud metadata IP addresses (`169.254.169.254`).
- Disallows non-HTTP protocols (`file://`, `gopher://`).
- Validates MIME types (only PNG, JPEG, GIF, and WebP permitted; SVG is explicitly rejected to eliminate SVG-embedded script execution).
- Enforces strict image size limits (5 MB) and network timeouts (6 seconds).

### 7.3 Cryptographic Authentication & Token Integrity
- **JWT Protection:** Signed using HMAC-SHA256. The server strictly verifies token signatures across both HTTP REST routes and WebSocket connection upgrade handshakes (`/yjs?token=...`).
- **Startup Secret Validation (`backend/src/config/env.js`):** The server refuses to initialize if `JWT_SECRET` is missing, under 32 characters, or set to known public default strings.
- **CORS Lockdown:** Strict origin controls restrict cross-origin requests to configured client domains.

---

## 8. Multi-Format Transformation & Export Pipeline

SynDoc features a bi-directional transformation pipeline enabling seamless interoperability between storage and export formats:

```
                  ┌──────────────────────┐
                  │    Markdown Input    │
                  └──────────┬───────────┘
                             │ markdownToAst.js
                             ▼
                  ┌──────────────────────┐
                  │ Recursive AST Model  │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │ astToHtml.js                    │ astToMarkdown
            ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│ Clean Semantic HTML  │          │ Formatted Markdown   │
└──────────┬───────────┘          └──────────────────────┘
           │ htmlToPdf.js (Puppeteer)
           ▼
┌──────────────────────┐
│ Vector-Rendered PDF  │
└──────────────────────┘
```

1. **AST to HTML (`backend/src/utils/astToHtml.js`):**
   - Transforms all 8 AST block types into semantic HTML5 markup (`<h1>`–`<h6>`, `<p>`, `<pre><code>`, `<blockquote>`, `<div class="callout">`, `<ul>`, `<ol>`, `<hr>`).
   - Renders inline styles (`strong`, `em`, `del`, `code`, `a`).
   - Generates document tables of contents with slugified header anchors.
   - Runs final sanitized output through DOMPurify with strict HTML tag whitelists.
2. **HTML to PDF (`backend/src/utils/htmlToPdf.js`):**
   - Spins up an optimized headless Chromium instance via Puppeteer.
   - Inlines CSS stylesheets and base64 assets to produce self-contained documents.
   - Generates publication-ready vector PDFs with custom headers, page numbering (`pageNumber / totalPages`), and configurable margins.
3. **Markdown to AST (`backend/src/utils/markdownToAst.js`):**
   - Parses Markdown syntax (headings, fenced code blocks with language identifiers, task checklists, blockquotes, bullet lists) directly into validated AST nodes.

---

## 9. Authentication, Authorization & Access Delegation

### 9.1 Multi-Mode Authentication Architecture
1. **Email Registration with Two-Factor OTP Verification:**
   - User inputs registration credentials.
   - Account is created in an unverified state (`isVerified: false`).
   - Backend creates a cryptographically secure 6-digit OTP, stores its salted bcrypt hash with a 10-minute TTL, and delivers it via Nodemailer.
   - Verifying the correct OTP marks the account active and returns a JWT token.
   - Enforces a 60-second cooldown between resend requests and locks out after 5 consecutive incorrect attempts.
2. **Google OAuth 2.0 PKCE Integration:**
   - Handled via `@react-oauth/google` and Google Cloud Console OAuth 2.0 Web Client credentials.
   - Frontend triggers popup authentication and obtains an authorization code.
   - Backend exchanges the code with Google OAuth APIs, extracts verified profile details (name, email, avatar), and auto-provisions or authenticates the user account.
3. **Password Recovery:**
   - Generates a single-use random hexadecimal reset token with a 1-hour expiration.
   - Token is delivered via email; password updates invalidate previous sessions.

### 9.2 Authorization & Room Code Collaboration
Documents support fine-grained role-based access:
- **Owner Rights:** Full administrative authority, deletion, collaborator management, and room-code generation.
- **Collaborator Rights:** Real-time editing, presence broadcast, export, and voluntary departure (`leaveDocument`).
- **Room Code Delegation (`SYNC-XXXX`):**
  - Owner can generate an alphanumeric room code (omitting ambiguous characters like `0`, `O`, `1`, `I`).
  - External users can submit this code to file an access request.
  - Generates secure single-use email approval tokens (`approveToken` / `rejectToken`) allowing document owners to approve or deny requests directly from their inbox without logging in.

---

## 10. Quality Assurance, Testing & Stress Verification

The project includes an extensive automated test suite covering unit, integration, stress, and end-to-end verification.

### 10.1 Automated Verification Suites

| Test Suite | Execution Command | Scope & Assertions | Status |
|---|---|---|---|
| **Offline AST & Sanitizer** | `npm run test:offline` | 23 DOMPurify XSS sanitizer assertions, 65 Markdown-to-AST round-trip checks, recursive metric calculations, circular reference detection. | **PASS (100%)** |
| **Y.Text Delta Tracking** | `npm run test:ytext` | Character-level delta insertion, emoji surrogate pair preservation, head/tail diff verification, concurrent typing merge. | **PASS (100%)** |
| **Client Block CRDT** | `npm run test:yblocks` | Frontend block lifecycle: middle insertions, emoji swaps, block updates, offline-to-online reconciliation. | **PASS (100%)** |
| **Transform & PDF Export** | `npm run test:transform` | AST-to-HTML rendering, table of contents generation, external image SSRF security blocking, image embedding. | **PASS (100%)** |
| **Live Database Sanitization** | `npm run test:sanitize-save` | Live socket injection of `<script>` and `javascript:` URIs; verifies clean persistence in MongoDB Atlas. | **PASS (100%)** |
| **WebSocket Synchronization** | `npm run test:ws` | Native `y-websocket` token authentication, concurrent socket edits, Socket.io cross-protocol bridging. | **PASS (100%)** |
| **Presence & Cursor Stream** | `npm run test:presence` | Multi-client cursor broadcasts, movement throttling, selection boundary updates, client disconnect cleanup. | **PASS (100%)** |
| **Block Locking Mutex** | `npm run test:lock` | Exclusive lock acquisition, rejection of concurrent requests, automatic lock release on disconnect. | **PASS (100%)** |
| **10-Client Stress Matrix** | `npm run test:stress` | 10 concurrent clients submitting rapid block additions over real-time sockets; zero message drops, 100% convergence. | **PASS (100%)** |

### 10.2 Concurrency Stress Test Results (`testStress.js`)
- **Simulated Load:** 10 independent socket clients simultaneously connecting to a single document room.
- **Operations:** Each client rapidly generates and commits new typed AST blocks.
- **Verification:** Database records are queried post-test. All blocks from all 10 clients are merged into the shared document without dropped packets, index corruption, or schema divergence.

---

## 11. Project Execution Timeline & Milestone Coverage

| Milestone | Deliverables & Implemented Modules | Source Code Artifacts | Status |
|---|---|---|---|
| **Week 1** | Recursive AST modeling, Mongoose pre-save change auditing, structural validation, block-level editor foundations. | `models/ASTNode.js`, `models/Document.js`, `middlewares/validateAST.js`, `components/Editor/Block.jsx` | Completed |
| **Week 2** | CRDT integration, character-level `Y.Text` delta-tracking, distributed block locking, presence cursors. | `services/crdtService.js`, `sockets/websocket.js`, `services/lockService.js`, `hooks/useYjsSync.js` | Completed |
| **Mid-Review** | 10-client real-time stress testing, Markdown-to-AST specification, delta-tracking test harness. | `docs/MARKDOWN_TO_JSON_SPEC.md`, `testStress.js`, `lib/yBlocks.js`, `testDeltaTracking.js` | Completed |
| **Week 3** | Transformation engine, semantic HTML rendering, Puppeteer PDF generation, live cursor overlay. | `utils/astToHtml.js`, `utils/htmlToPdf.js`, `utils/markdownToAst.js`, `components/Presence/CursorOverlay.jsx` | Completed |
| **Week 4** | DOMPurify security hardening, saved-block XSS injection protection, visual block state indicators. | `middlewares/sanitize.js`, `Document.js` pre-save hooks, `testSanitize.js`, `testSanitizeSave.js` | Completed |
| **Final Review** | Highly consistent synchronization layer, zero-overwrite data replication matrices, DNS resolution fix, and Google OAuth resilience. | `crdtService.js`, `syncService.js`, `syncHandler.js`, `config/db.js`, `config/env.js`, `Login.jsx` | Completed |

---

## 12. Deployment, Infrastructure & Operational Runbook

### 12.1 Environment Configuration Matrix

#### Backend Configuration (`backend/.env`):
```ini
PORT=5000
NODE_ENV=production
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/syncdoc?retryWrites=true&w=majority
JWT_SECRET=<cryptographically-random-48-byte-hex-string>
EMAIL_USER=notifications@yourdomain.com
EMAIL_PASS=<16-character-app-password>
GOOGLE_CLIENT_ID=<google-oauth-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

#### Frontend Configuration (`frontend/.env`):
```ini
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>.apps.googleusercontent.com
# Optional overrides for split-domain deployments:
# VITE_API_URL=https://api.yourdomain.com/api
# VITE_SOCKET_URL=https://api.yourdomain.com
# VITE_WS_URL=wss://api.yourdomain.com/yjs
```

### 12.2 Production Build & Execution Steps
1. **Dependency Installation:**
   ```bash
   npm run install:all
   ```
2. **Execute Full Test Verification:**
   ```bash
   npm run test:offline --prefix backend
   npm run test:yblocks --prefix frontend
   ```
3. **Frontend Production Build:**
   ```bash
   npm run build --prefix frontend
   ```
4. **Launch Backend Service:**
   ```bash
   npm start --prefix backend
   ```

### 12.2 Operational Health & Monitoring
The backend exposes a lightweight health check endpoint at `GET /health`:
```json
{
  "status": "ok",
  "database": {
    "status": "connected",
    "name": "syncdoc"
  },
  "uptime": "1420s"
}
```

---

## 13. Conclusion & Future Roadmap

The **SyncDoc Collaborative Document Engine** successfully fulfills all industrial requirements for high-concurrency, zero-data-loss document authoring. By synthesizing recursive AST data modeling, state-based Yjs CRDTs, distributed block locking, and multi-tier DOMPurify security controls, the platform guarantees mathematical convergence, high throughput, and robust defense against malicious payloads.

### Future Roadmap
1. **Granular Revision Branching:** Introducing Git-like branch-and-merge functionality on the AST tree for formal change approval workflows.
2. **End-to-End Encryption (E2EE):** Integrating WebCrypto AES-GCM encryption on Yjs binary update payloads prior to socket transmission, enabling zero-knowledge document collaboration.
3. **AI-Assisted Block Generation:** Integrating LLM streaming APIs to provide inline auto-completion, contextual summaries, and grammar refinement directly into AST blocks.

---
*Report compiled and certified for project submission.*  
**Author:** Engineering Team / SynDoc Core Contributor  
**Repository:** [PallaviPandurangPawar/SynDoc](https://github.com/PallaviPandurangPawar/SynDoc.git)  
**Branch:** `zeeshanhaider2410`
