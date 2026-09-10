const mongoose = require('mongoose');
const crypto = require('crypto');
const ASTNodeSchema = require('./ASTNode');
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
    modifiedPaths: [
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
      doc.changeHistory.push({
        version: 1,
        timestamp: new Date(),
        modifiedBy: doc.lastModifiedBy || 'anonymous',
        modifiedPaths: meaningfulChanges,
        action: 'CREATE',
        summary: `Document "${doc.title}" created with AST (${stats.nodeCount} node(s), depth ${stats.depth})`,
        stats: {
          nodeCount: stats.nodeCount,
          wordCount: stats.wordCount,
          depth: stats.depth
        }
      });
    } else if (meaningfulChanges.length > 0) {
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
      if (astChanges.length > 0) {
        summaryParts.push(
          `AST modified (${doc.stats.nodeCount} nodes, ${doc.stats.wordCount} words, depth ${doc.stats.depth})`
        );
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
        modifiedPaths: meaningfulChanges,
        action: 'UPDATE',
        summary: changeSummary,
        stats: {
          nodeCount: doc.stats.nodeCount,
          wordCount: doc.stats.wordCount,
          depth: doc.stats.depth
        }
      });

      // Keep last 50 change history entries to prevent unbounded document growth
      const MAX_HISTORY_LENGTH = 50;
      if (doc.changeHistory.length > MAX_HISTORY_LENGTH) {
        doc.changeHistory = doc.changeHistory.slice(-MAX_HISTORY_LENGTH);
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
Document.DocumentSchema = DocumentSchema;

module.exports = Document;
