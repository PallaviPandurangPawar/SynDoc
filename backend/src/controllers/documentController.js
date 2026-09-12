const mongoose = require('mongoose');
const documentService = require('../services/documentService');
const User = require('../models/User');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Create a new document
const createDocument = async (req, res) => {
  try {
    const { title, content, ast, owner, collaborators, lastModifiedBy } = req.body;

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
      owner,
      collaborators,
      lastModifiedBy
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

    const { title, content, ast, lastModifiedBy, owner, collaborators } = req.body;

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
      lastModifiedBy,
      owner,
      collaborators
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

    const { title, lastModifiedBy, owner } = req.body;

    const clonedDoc = await documentService.duplicateDocument(id, {
      title,
      lastModifiedBy,
      owner
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

    const results = await documentService.searchDocumentsByTitle(q);

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
    const count = await documentService.getDocumentCount();

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

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  getDocumentHistory,
  addCollaborator,
  removeCollaborator,
  searchDocuments,
  getStats
};

