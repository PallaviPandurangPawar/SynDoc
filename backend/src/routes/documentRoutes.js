const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getTrash,
  restoreDocument,
  permanentlyDeleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  searchDocuments,
  getStats,
  getDocumentLocks,
  getRoomCode,
  regenerateRoomCodeCtrl,
  toggleRoomCode,
  joinByCode,
  getJoinRequests,
  approveJoinRequestCtrl,
  rejectJoinRequestCtrl
} = require('../controllers/documentController');
const { validateAST } = require('../middlewares/validateAST');
const { protect } = require('../middlewares/auth');
const { requireDocumentAccess, requireDocumentOwner } = require('../middlewares/documentAccess');

router.use(protect);

// Global document routes
router.get('/', getDocuments);
router.post('/', validateAST, createDocument);
router.get('/search', searchDocuments);
router.get('/stats', getStats);

// Trash routes — must be registered BEFORE the '/:id' access-check middleware
// below, because that middleware only matches non-deleted documents.
router.get('/trash', getTrash);
router.patch('/:id/restore', restoreDocument);
router.delete('/:id/permanent', permanentlyDeleteDocument);

// Join-by-code — must also be registered BEFORE '/:id', since this takes a
// room code in the body, not a document id in the URL.
router.post('/join', joinByCode);

// All document-scoped routes require membership. Destructive or sharing actions
// add the owner-only middleware below.
router.use('/:id', requireDocumentAccess);

// Single document operations
router.get('/:id', getDocumentById);
router.put('/:id', validateAST, updateDocument);
router.patch('/:id', validateAST, updateDocument);
// Owner: moves the document to the trash. Any other member: just removes it from their own dashboard.
router.delete('/:id', deleteDocument);

// Document lifecycle & collaboration
router.post('/:id/duplicate', duplicateDocument);
router.get('/:id/history', getDocumentHistory);
router.post('/:id/collaborators', requireDocumentOwner, addCollaborator);
router.delete('/:id/collaborators/:userId', requireDocumentOwner, removeCollaborator);

// Room code — anyone with document access can view it (per your requirement);
// only the owner can regenerate/toggle it or manage who's waiting to join.
router.get('/:id/room-code', getRoomCode);
router.post('/:id/room-code/regenerate', requireDocumentOwner, regenerateRoomCodeCtrl);
router.patch('/:id/room-code/toggle', requireDocumentOwner, toggleRoomCode);
router.get('/:id/join-requests', requireDocumentOwner, getJoinRequests);
router.post('/:id/join-requests/:userId/approve', requireDocumentOwner, approveJoinRequestCtrl);
router.post('/:id/join-requests/:userId/reject', requireDocumentOwner, rejectJoinRequestCtrl);

// Real-time block-locking status
router.get('/:id/locks', getDocumentLocks);

// Nested AST & structural manipulation routes
const astRoutes = require('./astRoutes');
router.use('/:id/ast', astRoutes);

// Document export endpoints
const { exportDocumentPdf, exportDocumentHtml, exportDocumentMarkdown } = require('../controllers/exportController');
router.get('/:id/export/pdf', exportDocumentPdf);
router.get('/:id/export/html', exportDocumentHtml);
router.get('/:id/export/markdown', exportDocumentMarkdown);


module.exports = router;