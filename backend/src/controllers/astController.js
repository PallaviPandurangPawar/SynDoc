const Document = require('../models/Document');
const { validateASTStructure } = require('../middlewares/validateAST');
const crypto = require('crypto');

/**
 * Keeps `content` (the flat array used by the real-time CRDT layer) in sync
 * with `ast.children` (the tree used by this structural node API), whenever
 * a node is inserted, updated, deleted, or moved. Without this, a document
 * edited through this API would silently diverge from what live collaborators
 * see through the WebSocket/CRDT connection.
 */
function syncContentFromAst(document) {
  if (document.ast && Array.isArray(document.ast.children)) {
    document.content = document.ast.children;
    document.markModified('content');
  }
}

/**
 * Recursively find a node, its parent node, and its index among parent's children
 */
function findNodeWithParent(root, targetId, parent = null, index = -1) {
  if (!root || !targetId) return null;

  if (root.nodeId === targetId) {
    return { node: root, parent, index };
  }

  if (Array.isArray(root.children)) {
    for (let i = 0; i < root.children.length; i++) {
      const found = findNodeWithParent(root.children[i], targetId, root, i);
      if (found) return found;
    }
  }

  return null;
}

/**
 * GET /api/documents/:id/ast
 * Get document AST and metrics
 */
const getAST = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id).select('title version stats ast');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document AST retrieved successfully',
      data: {
        documentId: document._id,
        title: document.title,
        version: document.version,
        stats: document.stats,
        ast: document.ast
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * GET /api/documents/:id/ast/nodes/:nodeId
 * Get a specific node from the document AST
 */
const getNode = async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const match = findNodeWithParent(document.ast, nodeId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: `Node with ID "${nodeId}" not found in document AST`
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        node: match.node,
        parentId: match.parent ? match.parent.nodeId : null,
        index: match.index
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * POST /api/documents/:id/ast/nodes
 * Insert a new AST node under parentNodeId at optional index
 */
const insertNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { parentNodeId, index, node, lastModifiedBy } = req.body;

    if (!node || typeof node !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Node data is required'
      });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const targetParentId = parentNodeId || document.ast.nodeId;
    const parentMatch = findNodeWithParent(document.ast, targetParentId);
    if (!parentMatch) {
      return res.status(404).json({
        success: false,
        message: `Parent node "${targetParentId}" not found in AST`
      });
    }

    const newNode = {
      nodeId: node.nodeId || crypto.randomUUID(),
      type: node.type || 'paragraph',
      content: node.content || node.text || '',
      attributes: node.attributes || node.attrs || {},
      metadata: node.metadata || {},
      children: Array.isArray(node.children) ? node.children : []
    };

    const validation = validateASTStructure(newNode);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid node structure: ${validation.error}`
      });
    }

    if (!Array.isArray(parentMatch.node.children)) {
      parentMatch.node.children = [];
    }

    const insertIndex =
      typeof index === 'number' && index >= 0 && index <= parentMatch.node.children.length
        ? index
        : parentMatch.node.children.length;

    parentMatch.node.children.splice(insertIndex, 0, newNode);

    if (lastModifiedBy) document.lastModifiedBy = lastModifiedBy;
    document.markModified('ast');
    syncContentFromAst(document);

    const updatedDoc = await document.save();

    return res.status(201).json({
      success: true,
      message: 'AST node inserted successfully',
      data: {
        node: newNode,
        parentId: targetParentId,
        index: insertIndex,
        version: updatedDoc.version,
        stats: updatedDoc.stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * PUT/PATCH /api/documents/:id/ast/nodes/:nodeId
 * Update an existing AST node's content, type, or attributes
 */
const updateNode = async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const { content, text, type, attributes, attrs, metadata, lastModifiedBy } = req.body;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const match = findNodeWithParent(document.ast, nodeId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: `Node "${nodeId}" not found in AST`
      });
    }

    const targetNode = match.node;

    if (content !== undefined) targetNode.content = content;
    if (text !== undefined) targetNode.text = text;
    if (type !== undefined) targetNode.type = type;
    if (attributes !== undefined) {
      targetNode.attributes = { ...(targetNode.attributes || {}), ...attributes };
    }
    if (attrs !== undefined) {
      targetNode.attrs = { ...(targetNode.attrs || {}), ...attrs };
    }
    if (metadata !== undefined) {
      targetNode.metadata = { ...(targetNode.metadata || {}), ...metadata };
    }

    const validation = validateASTStructure(targetNode);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid node update: ${validation.error}`
      });
    }

    if (lastModifiedBy) document.lastModifiedBy = lastModifiedBy;
    document.markModified('ast');
    syncContentFromAst(document);

    const updatedDoc = await document.save();

    return res.status(200).json({
      success: true,
      message: 'AST node updated successfully',
      data: {
        node: targetNode,
        version: updatedDoc.version,
        stats: updatedDoc.stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * DELETE /api/documents/:id/ast/nodes/:nodeId
 * Remove a node from the AST
 */
const deleteNode = async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const { lastModifiedBy } = req.body || {};

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (document.ast && document.ast.nodeId === nodeId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the root node of the AST'
      });
    }

    const match = findNodeWithParent(document.ast, nodeId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: `Node "${nodeId}" not found in AST`
      });
    }

    // Remove from parent's children
    match.parent.children.splice(match.index, 1);

    if (lastModifiedBy) document.lastModifiedBy = lastModifiedBy;
    document.markModified('ast');
    syncContentFromAst(document);

    const updatedDoc = await document.save();

    return res.status(200).json({
      success: true,
      message: `Node "${nodeId}" deleted successfully`,
      data: {
        deletedNodeId: nodeId,
        version: updatedDoc.version,
        stats: updatedDoc.stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * POST /api/documents/:id/ast/nodes/:nodeId/move
 * Move a node to a new parent or reorder within children
 */
const moveNode = async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const { newParentNodeId, targetIndex, lastModifiedBy } = req.body;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (document.ast.nodeId === nodeId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot move the root node of the AST'
      });
    }

    const currentMatch = findNodeWithParent(document.ast, nodeId);
    if (!currentMatch) {
      return res.status(404).json({
        success: false,
        message: `Node "${nodeId}" not found in AST`
      });
    }

    const targetParentId = newParentNodeId || currentMatch.parent.nodeId;
    const newParentMatch = findNodeWithParent(document.ast, targetParentId);
    if (!newParentMatch) {
      return res.status(404).json({
        success: false,
        message: `Target parent node "${targetParentId}" not found in AST`
      });
    }

    // Remove from current parent
    const [removedNode] = currentMatch.parent.children.splice(currentMatch.index, 1);

    if (!Array.isArray(newParentMatch.node.children)) {
      newParentMatch.node.children = [];
    }

    const newIndex =
      typeof targetIndex === 'number' &&
      targetIndex >= 0 &&
      targetIndex <= newParentMatch.node.children.length
        ? targetIndex
        : newParentMatch.node.children.length;

    newParentMatch.node.children.splice(newIndex, 0, removedNode);

    if (lastModifiedBy) document.lastModifiedBy = lastModifiedBy;
    document.markModified('ast');
    syncContentFromAst(document);

    const updatedDoc = await document.save();

    return res.status(200).json({
      success: true,
      message: `Node "${nodeId}" moved successfully`,
      data: {
        nodeId,
        fromParent: currentMatch.parent.nodeId,
        toParent: targetParentId,
        targetIndex: newIndex,
        version: updatedDoc.version,
        stats: updatedDoc.stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * GET /api/documents/:id/ast/history
 * Get structural change history for the document
 */
const getStructuralHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id).select(
      'title version stats changeHistory'
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const structuralHistory = document.changeHistory.map((entry) => ({
      version: entry.version,
      timestamp: entry.timestamp,
      action: entry.action,
      modifiedBy: entry.modifiedBy,
      summary: entry.summary,
      stats: entry.stats,
      structuralChanges: entry.structuralChanges
    }));

    return res.status(200).json({
      success: true,
      data: {
        documentId: document._id,
        title: document.title,
        currentVersion: document.version,
        stats: document.stats,
        history: structuralHistory
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  getAST,
  getNode,
  insertNode,
  updateNode,
  deleteNode,
  moveNode,
  getStructuralHistory,
  findNodeWithParent
};
