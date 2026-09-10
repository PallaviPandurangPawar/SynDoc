const mongoose = require('mongoose');
const crypto = require('crypto');

const NODE_TYPES = [
  'root',
  'paragraph',
  'heading',
  'code',
  'blockquote',
  'list',
  'list-item',
  'text',
  'image',
  'divider',
  'callout'
];

/**
 * Recursive Schema for AST Nodes
 * Supports nested structures (e.g., root -> blocks -> inline text/elements)
 */
const ASTNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: [true, 'AST node must have a unique nodeId'],
      default: () => crypto.randomUUID()
    },
    type: {
      type: String,
      required: [true, 'AST node type is required'],
      enum: {
        values: NODE_TYPES,
        message: 'Invalid AST node type: {VALUE}'
      },
      default: 'paragraph'
    },
    content: {
      type: String,
      default: ''
    },
    attributes: {
      level: {
        type: Number,
        min: 1,
        max: 6,
        default: undefined
      },
      language: {
        type: String,
        trim: true,
        default: undefined
      },
      bold: { type: Boolean, default: false },
      italic: { type: Boolean, default: false },
      underline: { type: Boolean, default: false },
      strikethrough: { type: Boolean, default: false },
      code: { type: Boolean, default: false },
      link: { type: String, default: null },
      listType: {
        type: String,
        enum: ['bullet', 'ordered', 'check', null],
        default: null
      },
      checked: { type: Boolean, default: undefined },
      src: { type: String, default: null },
      alt: { type: String, default: null },
      caption: { type: String, default: null },
      calloutType: {
        type: String,
        enum: ['info', 'warning', 'success', 'error', null],
        default: null
      }
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    _id: false,
    id: false
  }
);

// Enable recursive nesting: node can have children of ASTNodeSchema type
ASTNodeSchema.add({
  children: {
    type: [ASTNodeSchema],
    default: () => []
  }
});

const ASTNode = mongoose.models.ASTNode || mongoose.model('ASTNode', ASTNodeSchema);

module.exports = {
  NODE_TYPES,
  ASTNodeSchema,
  ASTNode
};
