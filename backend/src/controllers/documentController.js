const documentService = require('../services/documentService');

// Create a new document
const createDocument = async (req, res) => {
  try {
    const { title, content, ast } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const newDocument = await documentService.createDocument({
      title,
      content,
      ast
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

// Get all documents
const getDocuments = async (req, res) => {
  try {
    const documents = await documentService.getAllDocuments();

    return res.status(200).json({
      success: true,
      message: 'Documents fetched successfully',
      data: documents
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

// Update document by ID
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, ast } = req.body;

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }

    const updatedDoc = await documentService.updateDocument(id, {
      title,
      content,
      ast
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
  searchDocuments,
  getStats
};
