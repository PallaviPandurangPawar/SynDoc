const crypto = require('crypto');

// In-memory mock storage
let documents = [];

const getAllDocuments = async () => {
  return documents;
};

const getDocumentById = async (id) => {
  const document = documents.find((doc) => doc.id === id);
  return document || null;
};

const createDocument = async ({ title, content = '', ast = {} }) => {
  const newDocument = {
    id: crypto.randomUUID(),
    title: title.trim(),
    content: content,
    ast: ast || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  documents.push(newDocument);
  return newDocument;
};

const updateDocument = async (id, { title, content, ast }) => {
  const index = documents.findIndex((doc) => doc.id === id);

  if (index === -1) {
    return null;
  }

  const existingDoc = documents[index];

  const updatedDoc = {
    ...existingDoc,
    title: title !== undefined ? title.trim() : existingDoc.title,
    content: content !== undefined ? content : existingDoc.content,
    ast: ast !== undefined ? ast : existingDoc.ast,
    updatedAt: new Date().toISOString()
  };

  documents[index] = updatedDoc;
  return updatedDoc;
};

const deleteDocument = async (id) => {
  const index = documents.findIndex((doc) => doc.id === id);

  if (index === -1) {
    return false;
  }

  documents.splice(index, 1);
  return true;
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument
};
