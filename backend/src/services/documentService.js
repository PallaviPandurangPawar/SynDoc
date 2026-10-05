const Document = require('../models/Document');
const crypto = require('crypto');
require('../models/User');
const { sanitizeDocumentContent } = require('../middlewares/sanitize');

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
    userId,
    includeAST = false
  } = options;

  const queryObj = { isDeleted: { $ne: true } };

  if (userId) {
    queryObj.$or = [{ owner: userId }, { collaborators: userId }];
  }

  if (search && search.trim() !== '') {
    queryObj.title = { $regex: search.trim(), $options: 'i' };
  }

  if (owner && !userId) {
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
  return Document.findOne({ _id: id, isDeleted: { $ne: true } })
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
 * Soft-delete a document by ID (marks it deleted instead of removing it,
 * so it can be recovered later and its history isn't lost)
 */
const deleteDocument = async (id, retentionDays = 7) => {
  const result = await Document.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    trashRetentionDays: retentionDays
  });
  return !!result;
};


/**
 * A member who is not the owner "deletes" a document from their own dashboard:
 * only that person is removed from the collaborators. Nobody else is affected.
 * (Uses a direct update, so it does not touch the content or the version history.)
 */
const leaveDocument = async (id, userId) => {
  const result = await Document.updateOne(
    { _id: id },
    { $pull: { collaborators: userId } }
  );
  return result.modifiedCount > 0;
};


/**
 * Fetch documents currently in the trash (soft-deleted, still within the 7-day window),
 * scoped to documents owned by this user (trash is personal, not shared)
 */
const getTrashedDocuments = async (userId) => {
  if (!userId) return [];

  // Each document carries its own retention length (set when it was deleted),
  // so the "still within the window" check is done per-document here rather
  // than with a single fixed date filter in the query.
  const allTrashed = await Document.find({ isDeleted: true, owner: userId })
    .sort({ deletedAt: -1 })
    .populate('owner', 'name email');

  const now = Date.now();
  return allTrashed.filter((doc) => {
    const retentionMs = (doc.trashRetentionDays || 7) * 24 * 60 * 60 * 1000;
    return now - new Date(doc.deletedAt).getTime() < retentionMs;
  });
};

/**
 * Restore a soft-deleted document back to normal (undo delete).
 * Only the owner can restore their own document.
 */
const restoreDocument = async (id, userId) => {
  const result = await Document.findOneAndUpdate(
    { _id: id, isDeleted: true, owner: userId },
    { isDeleted: false, deletedAt: null },
    { new: true }
  );
  return result;
};

/**
 * Permanently deletes any document that's been in the trash for more than 7 days.
 * Meant to be run periodically (see server.js).
 */
const purgeExpiredTrash = async () => {
  // Retention length varies per document, so this checks each one in JS
  // rather than using one fixed cutoff date in the query.
  const candidates = await Document.find({ isDeleted: true }).select('_id deletedAt trashRetentionDays');

  const now = Date.now();
  const expiredIds = candidates
    .filter((doc) => {
      const retentionMs = (doc.trashRetentionDays || 7) * 24 * 60 * 60 * 1000;
      return now - new Date(doc.deletedAt).getTime() >= retentionMs;
    })
    .map((doc) => doc._id);

  if (expiredIds.length === 0) return 0;

  const result = await Document.deleteMany({ _id: { $in: expiredIds } });
  return result.deletedCount;
};

/**
 * Duplicate / clone an existing document
 */
/**
 * Permanently deletes one document from the trash immediately (user-triggered).
 */
const permanentlyDeleteDocument = async (id, userId) => {
  const result = await Document.findOneAndDelete({
    _id: id,
    isDeleted: true,
    owner: userId
  });
  return result;
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

// Makes a short, easy-to-share code like "SYNC-7F2K"
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, so it's easy to read aloud
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SYNC-${code}`;
};

/**
 * Returns the document's room code, creating one on first use.
 * Anyone with access to the document (owner or collaborator) can call this.
 */
const getOrCreateRoomCode = async (id) => {
  const doc = await Document.findById(id);
  if (!doc) return null;

  if (!doc.roomCode) {
    doc.roomCode = generateRoomCode();
    await doc.save();
  }

  return doc;
};

/**
 * Owner-only: makes a brand new code, invalidating the old one immediately.
 */
const regenerateRoomCode = async (id) => {
  const doc = await Document.findById(id);
  if (!doc) return null;

  doc.roomCode = generateRoomCode();
  await doc.save();

  return doc;
};

/**
 * Owner-only: turns joining on or off without changing the code itself.
 */
const setRoomCodeEnabled = async (id, enabled) => {
  const doc = await Document.findById(id);
  if (!doc) return null;

  doc.roomCodeEnabled = enabled;
  if (enabled && !doc.roomCode) {
    doc.roomCode = generateRoomCode();
  }
  await doc.save();

  return doc;
};

/**
 * Called when someone submits a room code to join. Creates a pending
 * request unless they're already the owner, already a collaborator,
 * or already have a pending request on this document.
 */
const requestToJoinByCode = async (code, userId) => {
  const doc = await Document.findOne({
    roomCode: code.trim().toUpperCase(),
    roomCodeEnabled: true,
    isDeleted: { $ne: true }
  }).populate('owner', 'name email');

  if (!doc) {
    return { status: 'not_found' };
  }
  if (doc.owner && doc.owner._id.toString() === userId.toString()) {
    return { status: 'already_member', doc };
  }
  if (doc.collaborators.some((c) => c.toString() === userId.toString())) {
    return { status: 'already_member', doc };
  }
  if (doc.pendingRequests.some((r) => r.user.toString() === userId.toString())) {
    return { status: 'already_pending', doc };
  }

  const approveToken = crypto.randomBytes(24).toString('hex');
  const rejectToken = crypto.randomBytes(24).toString('hex');

  doc.pendingRequests.push({ user: userId, approveToken, rejectToken });
  await doc.save();

  return { status: 'requested', doc, approveToken, rejectToken };
};

/**
 * Called when the owner clicks the Approve link in an email. No login is
 * required — the long random token itself is the credential, and it can
 * only be used once, since the request is removed after it's acted on.
 */
const approveByToken = async (token) => {
  const doc = await Document.findOne({ 'pendingRequests.approveToken': token })
    .populate('pendingRequests.user', 'name email');
  if (!doc) {
    return { status: 'not_found' };
  }

  const request = doc.pendingRequests.find((r) => r.approveToken === token);
  const requesterName = request.user?.name || 'Someone';
  const requesterId = request.user?._id;

  doc.pendingRequests = doc.pendingRequests.filter((r) => r.approveToken !== token);

  if (requesterId) {
    const isAlreadyCollaborator = doc.collaborators.some(
      (c) => c.toString() === requesterId.toString()
    );
    if (!isAlreadyCollaborator) {
      doc.collaborators.push(requesterId);
    }
  }

  await doc.save();

  return { status: 'approved', documentTitle: doc.title, requesterName };
};

/**
 * Called when the owner clicks the Deny link in an email.
 */
const rejectByToken = async (token) => {
  const doc = await Document.findOne({ 'pendingRequests.rejectToken': token })
    .populate('pendingRequests.user', 'name email');
  if (!doc) {
    return { status: 'not_found' };
  }

  const request = doc.pendingRequests.find((r) => r.rejectToken === token);
  const requesterName = request.user?.name || 'Someone';

  doc.pendingRequests = doc.pendingRequests.filter((r) => r.rejectToken !== token);
  await doc.save();

  return { status: 'rejected', documentTitle: doc.title, requesterName };
};

/**
 * Owner-only: list of users waiting to be let into the document.
 */
const getPendingRequests = async (id) => {
  const doc = await Document.findById(id).populate('pendingRequests.user', 'name email avatarData');
  return doc ? doc.pendingRequests : [];
};

/**
 * Owner-only: approve a waiting user, making them a collaborator.
 */
const approveJoinRequest = async (id, userId) => {
  const doc = await Document.findById(id);
  if (!doc) return null;

  doc.pendingRequests = doc.pendingRequests.filter(
    (r) => r.user.toString() !== userId.toString()
  );

  const isAlreadyCollaborator = doc.collaborators.some(
    (c) => c.toString() === userId.toString()
  );
  if (!isAlreadyCollaborator) {
    doc.collaborators.push(userId);
  }

  await doc.save();

  return await Document.findById(id)
    .populate('owner', 'name email')
    .populate('collaborators', 'name email');
};

/**
 * Owner-only: reject a waiting user without adding them.
 */
const rejectJoinRequest = async (id, userId) => {
  const doc = await Document.findById(id);
  if (!doc) return null;

  doc.pendingRequests = doc.pendingRequests.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  await doc.save();

  return doc;
};

/**
 * Lightweight content update used by the CRDT auto-save path.
 * Skips full document validation (we already validate the AST ourselves
 * before calling this) to avoid a Mongoose bug that crashes on recursive
 * subdocument schemas when replacing large content arrays via .save().
 */
const patchDocumentContent = async (id, content) => {
  // Security: remove XSS fragments from the blocks before they are stored
  const safeContent = sanitizeDocumentContent(content);
  if (JSON.stringify(safeContent) !== JSON.stringify(content)) {
    console.warn(`🛡️ [Security] Removed unsafe markup from document ${id} before saving`);
  }

  // Also updates ast.children so real-time CRDT edits stay in sync with the
  // AST tree used by the structural node-editing API — otherwise the two
  // representations silently diverge and collaborators can lose each other's work.
  return await Document.findByIdAndUpdate(
    id,
    { $set: { content: safeContent, 'ast.children': safeContent } },
    { new: true, runValidators: false }
  );
};

/**
 * Search documents by title (text index with regex fallback)
 */
const searchDocumentsByTitle = async (query, userId) => {
  const accessFilter = userId
    ? { $or: [{ owner: userId }, { collaborators: userId }] }
    : {};

  try {
    const textResults = await Document.find(
      { ...accessFilter, $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    if (textResults && textResults.length > 0) {
      return textResults;
    }
  } catch (error) {
    // In case text index is not yet generated, fall back to case-insensitive regex
  }

  return await Document.find({
    ...accessFilter,
    title: { $regex: query, $options: 'i' }
  }).sort({ updatedAt: -1 });
};

/**
 * Get total document count
 */
const getDocumentCount = async (userId) => {
  if (!userId) return 0;
  return await Document.countDocuments({
    isDeleted: { $ne: true },
    $or: [{ owner: userId }, { collaborators: userId }]
  });
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  getTrashedDocuments,
  restoreDocument,
  purgeExpiredTrash,
  permanentlyDeleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  leaveDocument,
  patchDocumentContent,
  searchDocumentsByTitle,
  getDocumentCount,
  getOrCreateRoomCode,
  regenerateRoomCode,
  setRoomCodeEnabled,
  requestToJoinByCode,
  getPendingRequests,
  approveJoinRequest,
  rejectJoinRequest,
  approveByToken,
  rejectByToken
};
