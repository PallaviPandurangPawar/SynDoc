// Axios calls to backend REST endpoints
import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the logged-in user's token to every outgoing request, if one exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('syncdoc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getDocuments = async () => (await api.get('/documents')).data;
export const getDocumentById = async (id) => (await api.get(`/documents/${id}`)).data;
export const createDocument = async ({ title, content, ast }) => (await api.post('/documents', { title, content, ast })).data;
export const updateDocument = async (id, { title, content, ast }) => (await api.put(`/documents/${id}`, { title, content, ast })).data;
export const deleteDocument = async (id) => (await api.delete(`/documents/${id}`)).data;
export const getTrash = async () => (await api.get('/documents/trash')).data;
export const restoreDocument = async (id) => (await api.patch(`/documents/${id}/restore`)).data;
export const permanentlyDeleteDocument = async (id) => (await api.delete(`/documents/${id}/permanent`)).data;
export const getProfile = async () => (await api.get('/users/me')).data;
export const updateProfile = async (payload) => (await api.put('/users/me', payload)).data;

export const registerUser = async ({ name, email, password }) => (await api.post('/auth/register', { name, email, password })).data;
export const verifyOtp = async ({ email, otp }) => (await api.post('/auth/verify-otp', { email, otp })).data;
export const resendOtp = async ({ email }) => (await api.post('/auth/resend-otp', { email })).data;
export const loginUser = async ({ email, password }) => (await api.post('/auth/login', { email, password })).data;
export const googleLogin = async (code) => (await api.post('/auth/google', { code })).data;
export const forgotPassword = async (email) => (await api.post('/auth/forgot-password', { email })).data;
export const resetPassword = async (token, password) => (await api.post('/auth/reset-password', { token, password })).data;

// Room code (collaboration by code)
export const getRoomCode = async (id) => (await api.get(`/documents/${id}/room-code`)).data;
export const regenerateRoomCode = async (id) => (await api.post(`/documents/${id}/room-code/regenerate`)).data;
export const toggleRoomCode = async (id, enabled) => (await api.patch(`/documents/${id}/room-code/toggle`, { enabled })).data;
export const joinRoomByCode = async (code) => (await api.post('/documents/join', { code })).data;
export const getJoinRequests = async (id) => (await api.get(`/documents/${id}/join-requests`)).data;
export const approveJoinRequest = async (id, userId) => (await api.post(`/documents/${id}/join-requests/${userId}/approve`)).data;
export const rejectJoinRequest = async (id, userId) => (await api.post(`/documents/${id}/join-requests/${userId}/reject`)).data;

// Notifications (messages between users)
export const getNotifications = async () => (await api.get('/notifications')).data;
export const sendNotification = async ({ email, message }) => (await api.post('/notifications', { email, message })).data;
export const markNotificationRead = async (id) => (await api.patch(`/notifications/${id}/read`)).data;
export const markAllNotificationsRead = async () => (await api.patch('/notifications/read-all')).data;
export const deleteNotification = async (id) => (await api.delete(`/notifications/${id}`)).data;
export const clearNotifications = async () => (await api.delete('/notifications')).data;

// Chatbot (OpenRouter)
export const askChatbot = async ({ message, history }) => (await api.post('/chat', { message, history })).data;

export default api;