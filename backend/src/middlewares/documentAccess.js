const mongoose = require('mongoose');
const Document = require('../models/Document');

function isDocumentMember(document, userId) {
  if (!document || !userId) return false;

  const normalizedUserId = userId.toString();
  return (
    (document.owner && document.owner.toString() === normalizedUserId) ||
    (document.collaborators || []).some(
      (collaboratorId) => collaboratorId.toString() === normalizedUserId
    )
  );
}

async function findAccessibleDocument(documentId, user, { ownerOnly = false } = {}) {
  if (!mongoose.Types.ObjectId.isValid(documentId) || !user?._id) return null;

  const document = await Document.findOne({
    _id: documentId,
    isDeleted: { $ne: true }
  });

  if (!document || !isDocumentMember(document, user._id)) return null;
  if (ownerOnly && (!document.owner || document.owner.toString() !== user._id.toString())) {
    return null;
  }

  return document;
}

async function requireDocumentAccess(req, res, next) {
  try {
    const document = await findAccessibleDocument(req.params.id, req.user);
    if (!document) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this document'
      });
    }

    req.document = document;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireDocumentOwner(req, res, next) {
  if (!req.document || !req.document.owner || req.document.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only the document owner can perform this action'
    });
  }

  return next();
}

module.exports = {
  isDocumentMember,
  findAccessibleDocument,
  requireDocumentAccess,
  requireDocumentOwner
};