const VALID_TYPES = ['paragraph', 'heading', 'code', 'list', 'listItem', 'text'];

// Recursively validates a single AST node and all its nested children
function validateNode(node, path = 'root') {
  if (!node || typeof node !== 'object') {
    throw new Error(`Invalid node at ${path}: node must be an object`);
  }

  if (!VALID_TYPES.includes(node.type)) {
    throw new Error(`Invalid node type "${node.type}" at ${path}`);
  }

  if (node.type === 'heading') {
    const level = node.attrs && node.attrs.level;
    if (!level || level < 1 || level > 6) {
      throw new Error(`Heading node at ${path} must have attrs.level between 1 and 6`);
    }
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => {
      validateNode(child, `${path}.children[${index}]`);
    });
  }
}

// Validates the entire "content" array of a Document before save
function validateDocumentContent(content) {
  if (!Array.isArray(content)) {
    throw new Error('Document content must be an array of AST nodes');
  }
  content.forEach((node, index) => {
    validateNode(node, `content[${index}]`);
  });
}

module.exports = { validateNode, validateDocumentContent };
