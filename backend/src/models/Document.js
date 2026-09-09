const mongoose = require('mongoose');
const ASTNodeSchema = require('./ASTNode');

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'Untitled Document',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    content: {
      type: [ASTNodeSchema], // the actual document body — array of top-level AST nodes
      default: [],
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Document', DocumentSchema);
