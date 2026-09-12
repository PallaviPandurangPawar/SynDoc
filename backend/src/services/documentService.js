const Document = require('../models/Document');
require('../models/User');

/**
 * Fetch all documents with optional pagination, sorting, search filter, and AST projection
 */
const getAllDocuments = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    order = 'desc',
    search,
    owner,
    includeAST = false
  } = options;

  const queryObj = {};

  if (search && search.trim() !== '') {
    queryObj.title = { $regex: search.trim(), $options: 'i' };
  }

  if (owner) {
    queryObj.owner = owner;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj = { [sortBy]: sortOrder };

  let query = Document.find(queryObj).sort(sortObj).skip(skip).limit(limitNum);

  // If includeAST is false, omit the large AST and changeHistory to keep listing lightweight
  if (includeAST !== true && includeAST !== 'true') {
    query = query.select('-ast -changeHistory');
  }

  const [documents, total] = await Promise.all([
    query.exec(),
    Document.countDocuments(queryObj)
  ]);

  return {
    documents,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  };
};

/**
 * Get a single document by its ID
 */
const getDocumentById = async (id) => {
  return await Document.findById(id)
    .populate('owner', 'name email')
    .populate('collaborators', 'name email');
};

/**
 * Create a new document
 */
const createDocument = async ({
  title,
  content = [],
  ast,
  owner,
  collaborators,
  lastModifiedBy
}) => {
  const docData = {
    title: title.trim(),
    content
  };

  if (ast) docData.ast = ast;
  if (owner) docData.owner = owner;
  if (collaborators) docData.collaborators = collaborators;
  if (lastModifiedBy) docData.lastModifiedBy = lastModifiedBy;

  const newDocument = new Document(docData);
  return await newDocument.save();
};

/**
 * Update document by ID (full or partial)
 */
const updateDocument = async (id, updateFields = {}) => {
  const existingDoc = await Document.findById(id);
  if (!existingDoc) {
    return null;
  }

  const { title, content, ast, lastModifiedBy, owner, collaborators } = updateFields;

  if (title !== undefined) existingDoc.title = title.trim();
  if (content !== undefined) existingDoc.content = content;
  if (ast !== undefined) existingDoc.ast = ast;
  if (lastModifiedBy !== undefined) existingDoc.lastModifiedBy = lastModifiedBy;
  if (owner !== undefined) existingDoc.owner = owner;
  if (collaborators !== undefined) existingDoc.collaborators = collaborators;

  return await existingDoc.save();
};

/**
 * Delete a document by ID
 */
const deleteDocument = async (id) => {
  const result = await Document.findByIdAndDelete(id);
  return !!result;
};

/**
 * Duplicate / clone an existing document
 */
const duplicateDocument = async (id, options = {}) => {
  const original = await Document.findById(id);
  if (!original) {
    return null;
  }

  const { title, lastModifiedBy, owner } = options;
  const duplicateTitle = title && title.trim() !== '' ? title.trim() : `${original.title} (Copy)`;

  const docData = {
    title: duplicateTitle,
    content: original.content,
    ast: original.ast,
    owner: owner || original.owner,
    collaborators: original.collaborators,
    lastModifiedBy: lastModifiedBy || original.lastModifiedBy || 'anonymous'
  };

  const clonedDoc = new Document(docData);
  return await clonedDoc.save();
};

/**
 * Retrieve change / version history for a document
 */
const getDocumentHistory = async (id) => {
  const doc = await Document.findById(id).select('title version stats changeHistory');
  if (!doc) {
    return null;
  }

  return {
    documentId: doc._id,
    title: doc.title,
    currentVersion: doc.version,
    stats: doc.stats,
    history: doc.changeHistory
  };
};

/**
 * Add a collaborator to a document
 */
const addCollaborator = async (id, userId) => {
  const doc = await Document.findById(id);
  if (!doc) {
    return null;
  }

  const isAlreadyCollaborator = doc.collaborators.some(
    (collabId) => collabId.toString() === userId.toString()
  );

  if (!isAlreadyCollaborator) {
    doc.collaborators.push(userId);
    await doc.save();
  }

  return await Document.findById(id)
    .populate('owner', 'name email')
    .populate('collaborators', 'name email');
};

/**
 * Remove a collaborator from a document
 */
const removeCollaborator = async (id, userId) => {
  const doc = await Document.findById(id);
  if (!doc) {
    return null;
  }

  doc.collaborators = doc.collaborators.filter(
    (collabId) => collabId.toString() !== userId.toString()
  );

  await doc.save();

  return await Document.findById(id)
    .populate('owner', 'name email')
    .populate('collaborators', 'name email');
};

/**
 * Search documents by title (text index with regex fallback)
 */
const searchDocumentsByTitle = async (query) => {
  try {
    const textResults = await Document.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    if (textResults && textResults.length > 0) {
      return textResults;
    }
  } catch (error) {
    // In case text index is not yet generated, fall back to case-insensitive regex
  }

  return await Document.find({
    title: { $regex: query, $options: 'i' }
  }).sort({ updatedAt: -1 });
};

/**
 * Get total document count
 */
const getDocumentCount = async () => {
  return await Document.countDocuments();
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  searchDocumentsByTitle,
  getDocumentCount
};