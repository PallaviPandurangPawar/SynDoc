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
  getStats
} = require('../controllers/documentController');
const { validateAST } = require('../middlewares/validateAST');

// Global document routes
router.get('/', getDocuments);
router.post('/', validateAST, createDocument);
router.get('/search', searchDocuments);
router.get('/stats', getStats);

// Single document operations
router.get('/:id', getDocumentById);
router.put('/:id', validateAST, updateDocument);
router.patch('/:id', validateAST, updateDocument);
router.delete('/:id', deleteDocument);

// Document lifecycle & collaboration
router.post('/:id/duplicate', duplicateDocument);
router.get('/:id/history', getDocumentHistory);
router.post('/:id/collaborators', addCollaborator);
router.delete('/:id/collaborators/:userId', removeCollaborator);

// Nested AST & structural manipulation routes
const astRoutes = require('./astRoutes');
router.use('/:id/ast', astRoutes);

module.exports = router;

