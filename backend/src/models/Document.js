const mongoose = require('mongoose');
const crypto = require('crypto');
const ASTNodeSchema = require('./ASTNode');
require('./User');
const { validateDocumentContent } = require('../middlewares/validateAST');

/**
 * Traverses an AST tree recursively:
 * - Detects circular references via visited nodeIds
 * - Enforces a maximum nesting depth
 * - Calculates total nodeCount, wordCount, and maximum depth
 */
function calculateASTMetrics(rootNode, currentDepth = 1, visitedIds = new Set()) {
  if (!rootNode) {
    return { nodeCount: 0, wordCount: 0, depth: 0 };
  }

  // Prevent circular references
  if (rootNode.nodeId) {
    if (visitedIds.has(rootNode.nodeId)) {
      throw new Error(`Circular reference detected in AST at nodeId: "${rootNode.nodeId}"`);
    }
    visitedIds.add(rootNode.nodeId);
  }

  // Prevent excessive call stack / deeply nested trees
  const MAX_DEPTH = 50;
  if (currentDepth > MAX_DEPTH) {
    throw new Error(`AST exceeds maximum nesting depth of ${MAX_DEPTH} (current depth: ${currentDepth})`);
  }

  let nodeCount = 1;
  let wordCount = 0;

  const rawContent =
    typeof rootNode.content === 'string' && rootNode.content.trim().length > 0
      ? rootNode.content.trim()
      : typeof rootNode.text === 'string' && rootNode.text.trim().length > 0
        ? rootNode.text.trim()
        : '';

  if (rawContent.length > 0) {
    wordCount += rawContent.split(/\s+/).length;
  }

  let maxDepth = currentDepth;

  if (Array.isArray(rootNode.children) && rootNode.children.length > 0) {
    for (const child of rootNode.children) {
      const childMetrics = calculateASTMetrics(child, currentDepth + 1, visitedIds);
      nodeCount += childMetrics.nodeCount;
      wordCount += childMetrics.wordCount;
      if (childMetrics.depth > maxDepth) {
        maxDepth = childMetrics.depth;
      }
    }
  }

  return {
    nodeCount,
    wordCount,
    depth: maxDepth
  };
}

/**
 * Flattens an AST tree into a Map keyed by nodeId for structural comparison.
 */
function flattenASTNodes(rootNode, parentId = null, map = new Map(), position = 0) {
  if (!rootNode) return map;

  const rawNode = typeof rootNode.toObject === 'function' ? rootNode.toObject() : rootNode;
  const nodeId = rawNode.nodeId || 'root';

  map.set(nodeId, {
    nodeId,
    type: rawNode.type,
    parentId,
    position,
    content: (rawNode.content || rawNode.text || '').trim(),
    attributes: rawNode.attributes || rawNode.attrs || {}
  });

  if (Array.isArray(rawNode.children)) {
    rawNode.children.forEach((child, idx) => {
      flattenASTNodes(child, nodeId, map, idx);
    });
  }

  return map;
}

/**
 * Computes structural differences between two AST tree snapshots:
 * Detects inserted, deleted, moved/reparented, and modified nodes.
 */
function computeASTStructuralDiff(oldRoot, newRoot) {
  if (!oldRoot && !newRoot) {
    return {
      insertedNodes: [],
      deletedNodes: [],
      movedNodes: [],
      modifiedNodes: [],
      hasChanges: false
    };
  }

  const oldNodes = oldRoot ? flattenASTNodes(oldRoot) : new Map();
  const newNodes = newRoot ? flattenASTNodes(newRoot) : new Map();

  const insertedNodes = [];
  const deletedNodes = [];
  const movedNodes = [];
  const modifiedNodes = [];

  for (const [id, newNode] of newNodes.entries()) {
    if (!oldNodes.has(id)) {
      insertedNodes.push({
        nodeId: id,
        type: newNode.type,
        parentId: newNode.parentId
      });
    } else {
      const oldNode = oldNodes.get(id);
      const isMoved =
        oldNode.parentId !== newNode.parentId || oldNode.position !== newNode.position;
      if (isMoved) {
        movedNodes.push({
          nodeId: id,
          fromParent: oldNode.parentId,
          toParent: newNode.parentId,
          fromIndex: oldNode.position,
          toIndex: newNode.position
        });
      }

      const typeChanged = oldNode.type !== newNode.type;
      const contentChanged = oldNode.content !== newNode.content;
      const attrsChanged =
        JSON.stringify(oldNode.attributes) !== JSON.stringify(newNode.attributes);

      if (typeChanged || attrsChanged || contentChanged) {
        modifiedNodes.push({
          nodeId: id,
          oldType: oldNode.type,
          newType: newNode.type,
          contentChanged,
          attrsChanged
        });
      }
    }
  }

  for (const [id, oldNode] of oldNodes.entries()) {
    if (!newNodes.has(id)) {
      deletedNodes.push({
        nodeId: id,
        type: oldNode.type,
        parentId: oldNode.parentId
      });
    }
  }

  return {
    insertedNodes,
    deletedNodes,
    movedNodes,
    modifiedNodes,
    hasChanges:
      insertedNodes.length > 0 ||
      deletedNodes.length > 0 ||
      movedNodes.length > 0 ||
      modifiedNodes.length > 0
  };
}

/**
 * Sub-schema for granular AST structural change tracking
 */
const StructuralChangeSchema = new mongoose.Schema(
  {
    insertedNodes: [
      {
        nodeId: { type: String, required: true },
        type: { type: String },
        parentId: { type: String, default: null }
      }
    ],
    deletedNodes: [
      {
        nodeId: { type: String, required: true },
        type: { type: String },
        parentId: { type: String, default: null }
      }
    ],
    movedNodes: [
      {
        nodeId: { type: String, required: true },
        fromParent: { type: String, default: null },
        toParent: { type: String, default: null },
        fromIndex: { type: Number, default: 0 },
        toIndex: { type: Number, default: 0 }
      }
    ],
    modifiedNodes: [
      {
        nodeId: { type: String, required: true },
        oldType: { type: String },
        newType: { type: String },
        contentChanged: { type: Boolean, default: false },
        attrsChanged: { type: Boolean, default: false }
      }
    ]
  },
  {
    _id: false
  }
);

/**
 * Schema for tracking changes before document save
 */
const ChangeHistorySchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: String,
      default: 'anonymous'
    },
    changedPaths: [
      {
        type: String
      }
    ],
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'RESTORE'],
      default: 'UPDATE'
    },
    summary: {
      type: String,
      default: ''
    },
    stats: {
      nodeCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 },
      depth: { type: Number, default: 0 }
    },
    structuralChanges: {
      type: StructuralChangeSchema,
      default: () => ({
        insertedNodes: [],
        deletedNodes: [],
        movedNodes: [],
        modifiedNodes: []
      })
    }
  },
  {
    _id: true
  }
);

/**
 * Main Document Schema with recursive AST, ownership, collaborators, and pre-save change tracking
 */
const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      default: 'Untitled Document',
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    roomCode: {
      type: String,
      default: null, // e.g. "SYNC-7F2K", created the first time it's requested
      index: true
    },
    roomCodeEnabled: {
      type: Boolean,
      default: false // owner turns this on/off; off = code can't be used to join
    },
    pendingRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        requestedAt: {
          type: Date,
          default: Date.now
        },
        // One-click email approval — never expires, single-use (removed once acted on)
        approveToken: { type: String },
        rejectToken: { type: String }
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    content: {
      type: [ASTNodeSchema], // Document body as an array of top-level AST nodes
      default: []
    },
    ast: {
      type: ASTNodeSchema,
      default: () => ({
        nodeId: crypto.randomUUID(),
        type: 'root',
        content: '',
        attributes: {},
        metadata: {},
        children: []
      })
    },
    version: {
      type: Number,
      default: 1,
      min: 1
    },
    lastModifiedBy: {
      type: String,
      default: 'anonymous'
    },
    stats: {
      nodeCount: { type: Number, default: 1 },
      wordCount: { type: Number, default: 0 },
      depth: { type: Number, default: 1 }
    },
    changeHistory: {
      type: [ChangeHistorySchema],
      default: () => []
    }
  },
  {
    timestamps: true
  }
);

// Indexes
DocumentSchema.index({ title: 'text' });
DocumentSchema.index({ owner: 1 });
DocumentSchema.index({ updatedAt: -1 });

/**
 * Pre-save change tracking logic:
 * 1. Validates AST tree structure (circular reference check + max depth)
 * 2. Computes and updates AST metrics (nodeCount, wordCount, depth)
 * 3. Validates document content array if provided
 * 4. Detects modified paths via doc.modifiedPaths()
 * 5. Auto-increments document version on updates
 * 6. Appends an audit entry into changeHistory
 */
function preSaveDocument(doc, next) {
  try {
    // 1. Calculate metrics and structurally validate the AST tree
    if (doc.ast) {
      const metrics = calculateASTMetrics(doc.ast);
      doc.stats = metrics;

      // Sync content array from ast.children if content is empty
      if (
        (!doc.content || doc.content.length === 0) &&
        Array.isArray(doc.ast.children) &&
        doc.ast.children.length > 0
      ) {
        doc.content = doc.ast.children;
      }
    }

    // 2. Validate content array if present
    if (doc.content && Array.isArray(doc.content) && doc.content.length > 0) {
      validateDocumentContent(doc.content);

      // Sync ast.children from content if ast has no children
      if (doc.ast && (!doc.ast.children || doc.ast.children.length === 0)) {
        doc.ast.children = doc.content;
        doc.stats = calculateASTMetrics(doc.ast);
      }
    }

    // 3. Identify modified paths (excluding internal audit & timestamps)
    const modifiedPaths = typeof doc.modifiedPaths === 'function' ? doc.modifiedPaths() : [];
    const meaningfulChanges = modifiedPaths.filter(
      (path) =>
        !path.startsWith('changeHistory') &&
        path !== 'updatedAt' &&
        path !== 'version' &&
        path !== 'stats'
    );

    // 4. Track changes
    if (doc.isNew) {
      doc.version = 1;
      const stats = doc.stats || { nodeCount: 1, wordCount: 0, depth: 1 };

      const allNewNodes = flattenASTNodes(doc.ast);
      const initialInserts = [];
      for (const [id, n] of allNewNodes.entries()) {
        initialInserts.push({
          nodeId: id,
          type: n.type,
          parentId: n.parentId
        });
      }

      const structuralChanges = {
        insertedNodes: initialInserts,
        deletedNodes: [],
        movedNodes: [],
        modifiedNodes: []
      };

      doc.changeHistory.push({
        version: 1,
        timestamp: new Date(),
        modifiedBy: doc.lastModifiedBy || 'anonymous',
        changedPaths: meaningfulChanges,
        action: 'CREATE',
        summary: `Document "${doc.title}" created with AST (${stats.nodeCount} node(s), depth ${stats.depth})`,
        stats: {
          nodeCount: stats.nodeCount,
          wordCount: stats.wordCount,
          depth: stats.depth
        },
        structuralChanges
      });

      if (doc.ast) {
        doc._originalAst = JSON.parse(
          JSON.stringify(typeof doc.ast.toObject === 'function' ? doc.ast.toObject() : doc.ast)
        );
      }
    } else {
      const currentAstObj =
        doc.ast && typeof doc.ast.toObject === 'function' ? doc.ast.toObject() : doc.ast;
      const diff = doc._originalAst
        ? computeASTStructuralDiff(doc._originalAst, currentAstObj)
        : {
            insertedNodes: [],
            deletedNodes: [],
            movedNodes: [],
            modifiedNodes: [],
            hasChanges: false
          };

      const hasMeaningfulChanges = meaningfulChanges.length > 0 || diff.hasChanges;

      if (hasMeaningfulChanges) {
        doc.version += 1;

        // Generate clear, readable summary of what changed
        const summaryParts = [];
        if (meaningfulChanges.includes('title')) {
          summaryParts.push(`Title changed to "${doc.title}"`);
        }
        if (meaningfulChanges.includes('content')) {
          summaryParts.push('Document content modified');
        }

        const astChanges = meaningfulChanges.filter((p) => p.startsWith('ast'));
        if (astChanges.length > 0 || diff.hasChanges) {
          summaryParts.push(
            `AST modified (${doc.stats.nodeCount} nodes, ${doc.stats.wordCount} words, depth ${doc.stats.depth})`
          );
        }

        // Granular structural changes summary
        const structParts = [];
        if (diff.insertedNodes.length > 0) structParts.push(`+${diff.insertedNodes.length} node(s)`);
        if (diff.deletedNodes.length > 0) structParts.push(`-${diff.deletedNodes.length} node(s)`);
        if (diff.movedNodes.length > 0) structParts.push(`${diff.movedNodes.length} moved`);
        if (diff.modifiedNodes.length > 0) structParts.push(`${diff.modifiedNodes.length} modified`);
        if (structParts.length > 0) {
          summaryParts.push(`Structure: [${structParts.join(', ')}]`);
        }

        const otherChanges = meaningfulChanges.filter(
          (p) => p !== 'title' && p !== 'content' && !p.startsWith('ast')
        );
        if (otherChanges.length > 0) {
          summaryParts.push(`Fields updated: ${otherChanges.join(', ')}`);
        }

        const changeSummary = summaryParts.join(' | ') || 'Document updated';

        doc.changeHistory.push({
          version: doc.version,
          timestamp: new Date(),
          modifiedBy: doc.lastModifiedBy || 'anonymous',
          changedPaths: meaningfulChanges,
          action: 'UPDATE',
          summary: changeSummary,
          stats: {
            nodeCount: doc.stats.nodeCount,
            wordCount: doc.stats.wordCount,
            depth: doc.stats.depth
          },
          structuralChanges: {
            insertedNodes: diff.insertedNodes,
            deletedNodes: diff.deletedNodes,
            movedNodes: diff.movedNodes,
            modifiedNodes: diff.modifiedNodes
          }
        });

        // Keep last 50 change history entries to prevent unbounded document growth
        const MAX_HISTORY_LENGTH = 50;
        if (doc.changeHistory.length > MAX_HISTORY_LENGTH) {
          doc.changeHistory = doc.changeHistory.slice(-MAX_HISTORY_LENGTH);
        }

        if (currentAstObj) {
          doc._originalAst = JSON.parse(JSON.stringify(currentAstObj));
        }
      }
    }

    if (typeof next === 'function') next();
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      throw error;
    }
  }
}

/**
 * Capture original AST baseline upon document retrieval from database
 */
DocumentSchema.post('init', function () {
  if (this.ast) {
    this._originalAst = JSON.parse(
      JSON.stringify(typeof this.ast.toObject === 'function' ? this.ast.toObject() : this.ast)
    );
  }
});

DocumentSchema.pre('save', function (next) {
  preSaveDocument(this, next);
});

/**
 * Instance Method: Recursively search for a node by nodeId in this document's AST
 */
DocumentSchema.methods.findNode = function (targetNodeId) {
  if (!this.ast || !targetNodeId) return null;

  function search(node) {
    if (node.nodeId === targetNodeId) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
    }
    return null;
  }

  return search(this.ast);
};

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);

// Attach utilities directly to Document model for convenience
Document.calculateASTMetrics = calculateASTMetrics;
Document.preSaveDocument = preSaveDocument;
Document.computeASTStructuralDiff = computeASTStructuralDiff;
Document.flattenASTNodes = flattenASTNodes;
Document.DocumentSchema = DocumentSchema;

module.exports = Document;
