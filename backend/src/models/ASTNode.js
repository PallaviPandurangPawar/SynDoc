const mongoose = require('mongoose');

const ASTNodeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['paragraph', 'heading', 'code', 'list', 'listItem', 'text'],
      required: true,
    },
    attrs: {
      level: { type: Number }, // for headings (h1, h2, etc.)
      language: { type: String }, // for code blocks
    },
    text: {
      type: String, // actual text content, if this node is a text/leaf node
      default: '',
    },
    children: {
      type: [], // will hold nested ASTNode objects (self-referencing)
      default: [],
    },
  },
  { _id: true }
);

// Self-reference: children can contain more ASTNode schemas
ASTNodeSchema.add({ children: [ASTNodeSchema] });

module.exports = ASTNodeSchema;
