const mongoose = require('mongoose');
const ASTNodeSchema = require('./ASTNode');
const { validateDocumentContent } = require('../middlewares/validateAST');

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

DocumentSchema.pre('save', function (next) {
  try {
    validateDocumentContent(this.content);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Document', DocumentSchema);
