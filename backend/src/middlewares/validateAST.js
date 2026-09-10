const { NODE_TYPES } = require('../models/ASTNode');

/**
 * Validates an AST node and all its nested children recursively.
 *
 * @param {Object} node - AST node to validate
 * @param {number} depth - Current recursion depth
 * @param {Set<string>} seenIds - Set of visited nodeIds to prevent circular structures
 * @param {number} maxDepth - Maximum allowed recursion depth (default: 50)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateASTStructure(node, depth = 1, seenIds = new Set(), maxDepth = 50) {
  if (!node || typeof node !== 'object') {
    return { valid: false, error: 'AST node must be an object' };
  }

  if (depth > maxDepth) {
    return {
      valid: false,
      error: `AST tree depth exceeds maximum permitted limit of ${maxDepth}`
    };
  }

  if (node.nodeId) {
    if (typeof node.nodeId !== 'string') {
      return { valid: false, error: 'nodeId must be a string' };
    }
    if (seenIds.has(node.nodeId)) {
      return {
        valid: false,
        error: `Circular reference detected in AST tree at nodeId "${node.nodeId}"`
      };
    }
    seenIds.add(node.nodeId);
  }

  if (node.type && !NODE_TYPES.includes(node.type)) {
    return {
      valid: false,
      error: `Invalid AST node type "${node.type}". Allowed types: ${NODE_TYPES.join(', ')}`
    };
  }

  if (node.attributes) {
    if (typeof node.attributes !== 'object' || Array.isArray(node.attributes)) {
      return { valid: false, error: 'Node attributes must be a key-value object' };
    }
    if (node.attributes.level !== undefined) {
      const level = node.attributes.level;
      if (typeof level !== 'number' || level < 1 || level > 6) {
        return { valid: false, error: 'Heading level attribute must be a number between 1 and 6' };
      }
    }
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      return { valid: false, error: 'AST children property must be an array' };
    }

    for (let i = 0; i < node.children.length; i++) {
      const childResult = validateASTStructure(node.children[i], depth + 1, seenIds, maxDepth);
      if (!childResult.valid) {
        return childResult;
      }
    }
  }

  return { valid: true };
}

/**
 * Express Middleware for pre-save AST structural validation on requests
 */
const validateAST = (req, res, next) => {
  const { ast } = req.body;

  // If request does not provide an AST, allow it through (optional payload)
  if (ast === undefined || ast === null) {
    return next();
  }

  const validation = validateASTStructure(ast);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: `AST Validation Error: ${validation.error}`
    });
  }

  next();
};

module.exports = {
  validateAST,
  validateASTStructure
};
