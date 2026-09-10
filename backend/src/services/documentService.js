const Document = require('../models/Document');

const getAllDocuments = async () => {
  return await Document.find().sort({ updatedAt: -1 });
};

const getDocumentById = async (id) => {
  return await Document.findById(id);
};

const createDocument = async ({ title, content = [], ast }) => {
  const docData = {
    title: title.trim(),
    content,
  };
  if (ast) docData.ast = ast;
  const newDocument = new Document(docData);
  return await newDocument.save();
};

const updateDocument = async (id, { title, content, ast }) => {
  const existingDoc = await Document.findById(id);
  if (!existingDoc) {
    return null;
  }

  if (title !== undefined) existingDoc.title = title.trim();
  if (content !== undefined) existingDoc.content = content;
  if (ast !== undefined) existingDoc.ast = ast;

  return await existingDoc.save();
};

const deleteDocument = async (id) => {
  const result = await Document.findByIdAndDelete(id);
  return !!result;
};

const searchDocumentsByTitle = async (query) => {
  return await Document.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

const getDocumentCount = async () => {
  return await Document.countDocuments();
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  searchDocumentsByTitle,
  getDocumentCount,
};