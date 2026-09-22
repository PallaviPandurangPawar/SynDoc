const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const documentRoutes = require('./routes/documentRoutes');
const exportRoutes = require('./routes/exportRoutes');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'SyncDoc API is running'
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const dbName = mongoose.connection.name || 'unknown';

  res.json({
    status: 'ok',
    database: {
      status: dbStatus,
      name: dbName,
    },
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.use('/api/documents', documentRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/auth', authRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error Handler Middleware
app.use(errorHandler);

module.exports = app;
