// Axios calls to backend REST endpoints
// TODO: implement

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

export const getDocuments = async () => (await api.get('/documents')).data;
export const getDocumentById = async (id) => (await api.get(`/documents/${id}`)).data;
export const createDocument = async ({ title, content, ast }) => (await api.post('/documents', { title, content, ast })).data;
export const updateDocument = async (id, { title, content, ast }) => (await api.put(`/documents/${id}`, { title, content, ast })).data;
export const deleteDocument = async (id) => (await api.delete(`/documents/${id}`)).data;

export default api;