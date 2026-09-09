const Document = require('../models/Document');

const getAllDocuments = async () => {
  return await Document.find().sort({ updatedAt: -1 });
};

const getDocumentById = async (id) => {
  return await Document.findById(id);
};

const createDocument = async ({ title, content = [] }) => {
  const newDocument = new Document({
    title: title.trim(),
    content,
  });
  return await newDocument.save();
};

const updateDocument = async (id, { title, content }) => {
  const existingDoc = await Document.findById(id);
  if (!existingDoc) {
    return null;
  }

  if (title !== undefined) existingDoc.title = title.trim();
  if (content !== undefined) existingDoc.content = content;

  return await existingDoc.save();
};

const deleteDocument = async (id) => {
  const result = await Document.findByIdAndDelete(id);
  return !!result;
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
};