const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const invoiceRoutes = require('./routes/invoices');
const yarnRoutes = require('./routes/yarn');
const cashbookRoutes = require('./routes/cashbook');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB Connection ──────────────────────────────────────
let isConnected = false;
async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  const atlasUri = process.env.MONGODB_URI;
  if (!atlasUri) {
    console.error('❌ MONGODB_URI is not set in environment variables.');
    return;
  }

  try {
    const db = await mongoose.connect(atlasUri, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = db.connections[0].readyState === 1;
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ Atlas connection failed:', err.message);
    console.error('👉 Please check your IP whitelist on MongoDB Atlas (https://cloud.mongodb.com)');
  }
}

app.use(async (req, res, next) => {
  if (process.env.MONGODB_URI) {
    await connectDB();
  }
  next();
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/invoices', invoiceRoutes);
app.use('/api/yarn', yarnRoutes);
app.use('/api/cashbook', cashbookRoutes);

// ── SPA Fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Local Server Start ─────────────────────────────────────
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  });
}

// Export app for Vercel
module.exports = app;
