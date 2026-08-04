const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/index');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/index');

const app = express();

// ── Security Middleware ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const corsOrigin = process.env.CORS_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174'
const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : corsOrigin.split(',').map((origin) => origin.trim())

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS origin not allowed'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Device-Secret'],
  credentials: true,
  maxAge: 86400,
}))

app.use(compression());

// ── Body Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Logging ───────────────────────────────────────────────────────
app.use(morgan('combined', { 
  stream: { write: (message) => logger.http(message.trim()) } 
}));

// ── Rate Limiting ─────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health Check ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'SmartTransit AI',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// ── API Routes ────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Static Files ──────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// ── SPA Fallback ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexHtml = path.join(frontendDist, 'index.html');
    res.sendFile(indexHtml, (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          message: 'Resource not found',
        });
      }
    });
  }
});

// ── Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
