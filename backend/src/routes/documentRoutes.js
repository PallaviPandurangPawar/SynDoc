const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  searchDocuments,
  getStats
} = require('../controllers/documentController');

router.post('/', createDocument);
router.get('/', getDocuments);
router.get('/search', searchDocuments);
router.get('/stats', getStats);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
