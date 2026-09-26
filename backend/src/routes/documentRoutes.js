const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  searchDocuments,
  getStats,
  getDocumentLocks
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

// All document-scoped routes require membership. Destructive or sharing actions
// add the owner-only middleware below.
router.use('/:id', requireDocumentAccess);

// Single document operations
router.get('/:id', getDocumentById);
router.put('/:id', validateAST, updateDocument);
router.patch('/:id', validateAST, updateDocument);
router.delete('/:id', requireDocumentOwner, deleteDocument);

// Document lifecycle & collaboration
router.post('/:id/duplicate', duplicateDocument);
router.get('/:id/history', getDocumentHistory);
router.post('/:id/collaborators', requireDocumentOwner, addCollaborator);
router.delete('/:id/collaborators/:userId', requireDocumentOwner, removeCollaborator);

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

