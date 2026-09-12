const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getAST,
  getNode,
  insertNode,
  updateNode,
  deleteNode,
  moveNode,
  getStructuralHistory
} = require('../controllers/astController');

// Routes mounted at /api/documents/:id/ast
router.get('/', getAST);
router.get('/history', getStructuralHistory);
router.get('/nodes/:nodeId', getNode);
router.post('/nodes', insertNode);
router.put('/nodes/:nodeId', updateNode);
router.patch('/nodes/:nodeId', updateNode);
router.delete('/nodes/:nodeId', deleteNode);
router.post('/nodes/:nodeId/move', moveNode);

module.exports = router;
