const mongoose = require('mongoose');
const documentService = require('../services/documentService');
const User = require('../models/User');
const lockService = require('../services/lockService');
const { sendJoinRequestEmail } = require('../services/emailService');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Create a new document
const createDocument = async (req, res) => {
  try {
    const { title, content, ast, collaborators } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const newDocument = await documentService.createDocument({
      title,
      content,
      ast,
      owner: req.user._id,
      collaborators,
      lastModifiedBy: req.user.name
    });

    return res.status(201).json({
      success: true,
      message: 'Document created successfully',
      data: newDocument
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get all documents with pagination & filtering
const getDocuments = async (req, res) => {
  try {
    const { page, limit, sortBy, order, search, owner, includeAST } = req.query;

    const result = await documentService.getAllDocuments({
      page,
      limit,
      sortBy,
      order,
      search,
      owner,
      userId: req.user._id,
      includeAST
    });

    return res.status(200).json({
      success: true,
      message: 'Documents fetched successfully',
      pagination: result.pagination,
      data: result.documents
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get single document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const document = await documentService.getDocumentById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document retrieved successfully',
      data: document
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update document by ID (PUT or PATCH)
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const { title, content, ast } = req.body;

    // Ownership check: only enforced if the document already has an owner assigned.
    // Documents with no owner (e.g. anonymous test docs) remain open, unchanged from before.
    const existingDoc = await documentService.getDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    if (existingDoc.owner && existingDoc.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this document'
      });
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }

    const updatedDoc = await documentService.updateDocument(id, {
      title,
      content,
      ast,
      lastModifiedBy: req.user.name,
      owner: undefined,
      collaborators: undefined
    });

    if (!updatedDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: updatedDoc
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Delete document by ID
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    // Ownership check: only enforced if the document already has an owner assigned.
    const existingDoc = await documentService.getDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    if (existingDoc.owner && existingDoc.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this document'
      });
    }

    const isDeleted = await documentService.deleteDocument(id);

    if (!isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get all documents currently in the trash (soft-deleted, within 7-day window)
const getTrash = async (req, res) => {
  try {
    const trashedDocs = await documentService.getTrashedDocuments(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Trash fetched successfully',
      data: trashedDocs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Restore a soft-deleted document out of the trash
const restoreDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const restoredDoc = await documentService.restoreDocument(id, req.user._id);

    if (!restoredDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found in trash'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document restored successfully',
      data: restoredDoc
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Permanently delete a document that's already in the trash
const permanentlyDeleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const deleted = await documentService.permanentlyDeleteDocument(id, req.user._id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found in trash'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document permanently deleted'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Duplicate / clone document by ID
const duplicateDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const { title } = req.body;

    const clonedDoc = await documentService.duplicateDocument(id, {
      title,
      lastModifiedBy: req.user.name,
      owner: req.user._id
    });

    if (!clonedDoc) {
      return res.status(404).json({
        success: false,
        message: 'Original document not found'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Document duplicated successfully',
      data: clonedDoc
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get document change / version history
const getDocumentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    const historyData = await documentService.getDocumentHistory(id);

    if (!historyData) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document history retrieved successfully',
      data: historyData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Add collaborator to document
const addCollaborator = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User to add as collaborator not found'
      });
    }

    const updatedDoc = await documentService.addCollaborator(id, userId);

    if (!updatedDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Collaborator added successfully',
      data: updatedDoc
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Remove collaborator from document
const removeCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format'
      });
    }

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId is required'
      });
    }

    const updatedDoc = await documentService.removeCollaborator(id, userId);

    if (!updatedDoc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Collaborator removed successfully',
      data: updatedDoc
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Search documents by title
const searchDocuments = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required (use ?q=yourSearchTerm)'
      });
    }

    const results = await documentService.searchDocumentsByTitle(q, req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      count: results.length,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get total document count
const getStats = async (req, res) => {
  try {
    const count = await documentService.getDocumentCount(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Stats fetched successfully',
      data: { totalDocuments: count }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get currently active block locks for a document
const getDocumentLocks = async (req, res) => {
  try {
    const { id } = req.params;
    const locks = lockService.getLocks(id);

    return res.status(200).json({
      success: true,
      message: 'Active locks fetched successfully',
      data: locks
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get (or create) a document's room code. Only the owner receives the real
// code; collaborators get roomCode: null, so the frontend shows it masked.
const getRoomCode = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await documentService.getOrCreateRoomCode(id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const isOwner = doc.owner && doc.owner.toString() === req.user._id.toString();

    return res.status(200).json({
      success: true,
      data: {
        roomCode: isOwner ? doc.roomCode : null,
        roomCodeEnabled: doc.roomCodeEnabled,
        isOwner
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Owner-only: generate a brand new code, invalidating the old one
const regenerateRoomCodeCtrl = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await documentService.regenerateRoomCode(id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Room code regenerated',
      data: { roomCode: doc.roomCode, roomCodeEnabled: doc.roomCodeEnabled }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Owner-only: turn joining on or off
const toggleRoomCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (true/false) is required' });
    }

    const doc = await documentService.setRoomCodeEnabled(id, enabled);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.status(200).json({
      success: true,
      message: enabled ? 'Room joining enabled' : 'Room joining disabled',
      data: { roomCode: doc.roomCode, roomCodeEnabled: doc.roomCodeEnabled }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Any logged-in user: submit a code to request joining that document
const joinByCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'A room code is required' });
    }

    const result = await documentService.requestToJoinByCode(code, req.user._id);

    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, message: 'Invalid or inactive room code' });
    }
    if (result.status === 'already_member') {
      return res.status(409).json({ success: false, message: 'You already have access to this document' });
    }
    if (result.status === 'already_pending') {
      return res.status(409).json({ success: false, message: 'You already requested to join this document. Waiting for approval.' });
    }

    // Email the owner with one-click Approve/Deny links — no login needed to use them
    if (result.doc.owner?.email) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const approveUrl = `${baseUrl}/api/room-action/approve/${result.approveToken}`;
      const rejectUrl = `${baseUrl}/api/room-action/reject/${result.rejectToken}`;

      sendJoinRequestEmail(
        result.doc.owner.email,
        result.doc.owner.name,
        result.doc.title,
        req.user.name,
        req.user.email,
        approveUrl,
        rejectUrl
      ).catch((err) => console.error('❌ Failed to send join-request email:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Request sent. The document owner has been emailed and can approve it directly from there.',
      data: { documentId: result.doc._id, title: result.doc.title }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Owner-only: list of people waiting to join
const getJoinRequests = async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await documentService.getPendingRequests(id);

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Owner-only: approve someone waiting to join, making them a collaborator
const approveJoinRequestCtrl = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    const updatedDoc = await documentService.approveJoinRequest(id, userId);

    if (!updatedDoc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Request approved. They can now access this document.',
      data: updatedDoc
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Owner-only: reject someone waiting to join
const rejectJoinRequestCtrl = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    const doc = await documentService.rejectJoinRequest(id, userId);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.status(200).json({ success: true, message: 'Request rejected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getTrash,
  restoreDocument,
  permanentlyDeleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  searchDocuments,
  getStats,
  getDocumentLocks,
  getRoomCode,
  regenerateRoomCodeCtrl,
  toggleRoomCode,
  joinByCode,
  getJoinRequests,
  approveJoinRequestCtrl,
  rejectJoinRequestCtrl
};

