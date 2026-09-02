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
const contractRoutes = require('./routes/contracts');

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
    throw new Error('MONGODB_URI environment variable is missing. Please add MONGODB_URI in Vercel Project Settings -> Environment Variables.');
  }

  const db = await mongoose.connect(atlasUri, {
    serverSelectionTimeoutMS: 10000,
  });
  isConnected = db.connections[0].readyState === 1;
  console.log('✅ Connected to MongoDB Atlas');
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Atlas connection failed:', err.message);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        error: 'Database Connection Error',
        message: err.message,
        hint: 'Make sure MONGODB_URI is set in Vercel environment variables and Network Access on MongoDB Atlas includes 0.0.0.0/0 (Allow Access from Anywhere).'
      });
    }
    next();
  }
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/invoices', invoiceRoutes);
app.use('/api/yarn', yarnRoutes);
app.use('/api/cashbook', cashbookRoutes);
app.use('/api/contracts', contractRoutes);

// ── SPA Fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Local Server Start ─────────────────────────────────────
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB Atlas at startup:', err.message);
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`⚠️ Server running in offline/degraded mode on http://localhost:${PORT}`);
        console.log(`👉 Check MongoDB Atlas Network Access (IP Whitelist) or cluster status.`);
      });
    });
}

// Export app for Vercel
module.exports = app;
