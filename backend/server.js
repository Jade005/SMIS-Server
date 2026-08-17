const express = require('express');
const cors = require('cors');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { pool } = require('./config/db');

// Import Route Modules
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const saleRoutes = require('./routes/saleRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root Status Dashboard
app.get('/', async (req, res) => {
  let dbStatus = 'Checking...';
  let dbColor = '#f59e0b';
  let dbIcon = '⏳';
  let dbTables = [];
  let dbError = '';
  let dbName = process.env.DB_NAME || 'smis';

  try {
    const conn = await pool.getConnection();
    const [tables] = await conn.query('SHOW TABLES');
    conn.release();
    dbStatus = 'Connected';
    dbColor = '#10b981';
    dbIcon = '✅';
    dbTables = tables.map((row) => Object.values(row)[0]);
  } catch (err) {
    dbStatus = 'Failed';
    dbColor = '#ef4444';
    dbIcon = '❌';
    dbError = err.message;
  }

  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`;

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SMIS Backend Status</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', sans-serif;
    background: #0f172a;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 40px 20px;
    color: #e2e8f0;
  }
  .badge-server {
    background: #1e293b;
    border: 1px solid #334155;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 32px;
    font-weight: 800;
    text-align: center;
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }
  .subtitle {
    font-size: 14px;
    color: #64748b;
    text-align: center;
    margin-bottom: 36px;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    width: 100%;
    max-width: 900px;
    margin-bottom: 24px;
  }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 22px;
  }
  .card-icon {
    font-size: 28px;
    margin-bottom: 8px;
  }
  .card-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .card-value {
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
  }
  .db-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 24px;
    width: 100%;
    max-width: 900px;
    margin-bottom: 24px;
  }
  .db-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #334155;
  }
  .db-status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${dbColor};
    box-shadow: 0 0 8px ${dbColor};
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .db-title { font-size: 16px; font-weight: 700; }
  .db-subtitle { font-size: 13px; color: #64748b; }
  .db-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .db-meta-item { background: #0f172a; padding: 12px 16px; border-radius: 8px; border: 1px solid #1e293b; }
  .db-meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 2px; }
  .db-meta-value { font-size: 14px; font-weight: 600; color: #f1f5f9; }
  .table-section-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .table-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    background: #0f172a;
    border: 1px solid #1e40af;
    color: #93c5fd;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    font-family: 'Inter', monospace;
  }
  .error-box {
    background: #450a0a;
    border: 1px solid #ef4444;
    color: #fca5a5;
    font-size: 12px;
    padding: 12px;
    border-radius: 8px;
    font-family: monospace;
    margin-top: 12px;
  }
  .footer {
    font-size: 12px;
    color: #475569;
    text-align: center;
    margin-top: 8px;
  }
  .api-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 24px;
    width: 100%;
    max-width: 900px;
    margin-bottom: 24px;
  }
  .api-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #f1f5f9; }
  .api-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .api-chip {
    background: #0f172a;
    border: 1px solid #334155;
    color: #a78bfa;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 100px;
    font-family: monospace;
  }
</style>
</head>
<body>
  <div class="badge-server">SMIS API Server — v1.0</div>
  <h1>🥩 Slaughterhouse SMIS Backend</h1>
  <p class="subtitle">REST API for the Slaughterhouse Meat Inventory & Sales Management System</p>

  <div class="card-grid">
    <div class="card">
      <div class="card-icon">🚀</div>
      <div class="card-label">Server Status</div>
      <div class="card-value" style="color:#10b981;">Running</div>
    </div>
    <div class="card">
      <div class="card-icon">⚡</div>
      <div class="card-label">Environment</div>
      <div class="card-value">${process.env.NODE_ENV || 'development'}</div>
    </div>
    <div class="card">
      <div class="card-icon">🌐</div>
      <div class="card-label">Server Port</div>
      <div class="card-value">${process.env.PORT || 5000}</div>
    </div>
    <div class="card">
      <div class="card-icon">⏱️</div>
      <div class="card-label">Uptime</div>
      <div class="card-value">${uptimeFormatted}</div>
    </div>
  </div>

  <div class="db-card">
    <div class="db-header">
      <div class="db-status-dot"></div>
      <div>
        <div class="db-title">${dbIcon} Database Connection</div>
        <div class="db-subtitle">MySQL — <strong style="color:${dbColor}">${dbStatus}</strong></div>
      </div>
    </div>
    <div class="db-meta-grid">
      <div class="db-meta-item">
        <div class="db-meta-label">Host</div>
        <div class="db-meta-value">${process.env.DB_HOST || 'localhost'}</div>
      </div>
      <div class="db-meta-item">
        <div class="db-meta-label">Port</div>
        <div class="db-meta-value">${process.env.DB_PORT || 3306}</div>
      </div>
      <div class="db-meta-item">
        <div class="db-meta-label">Database</div>
        <div class="db-meta-value">${dbName}</div>
      </div>
      <div class="db-meta-item">
        <div class="db-meta-label">User</div>
        <div class="db-meta-value">${process.env.DB_USER || 'smis'}</div>
      </div>
    </div>
    ${dbTables.length > 0 ? `
    <div class="table-section-label">Verified Tables (${dbTables.length} found in "${dbName}")</div>
    <div class="table-chips">
      ${dbTables.map((t) => `<span class="chip">${t}</span>`).join('')}
    </div>` : ''}
    ${dbError ? `<div class="error-box">⚠ Connection Error: ${dbError}</div>` : ''}
  </div>

  <div class="api-card">
    <div class="api-title">📡 Available API Endpoints</div>
    <div class="api-list">
      ${['/api/health','/api/auth','/api/users','/api/categories','/api/products','/api/suppliers','/api/inventory','/api/sales','/api/orders','/api/reports','/api/analytics'].map((e) => `<span class="api-chip">${e}</span>`).join('')}
    </div>
  </div>

  <div class="footer">Generated at ${new Date().toLocaleString()} · SMIS-Server running on Node.js ${process.version}</div>
</body>
</html>`);
});

// Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'SMIS REST API Backend Server (SMIS-Server) is running',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 SMIS Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================================`);
});

module.exports = app;
