import './env.js';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import pharmacyDb from './db/pharmacyConnection.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const MONGODB_URI = process.env.MONGODB_URI;
const PHARMACY_MONGODB_URI = process.env.PHARMACY_MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment variables.');
  process.exit(1);
}
if (!PHARMACY_MONGODB_URI) {
  console.error('PHARMACY_MONGODB_URI is not set in environment variables.');
  process.exit(1);
}

// Only the admin UI origin(s) may call this API from a browser.
const allowedOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '200kb' }));
app.set('trust proxy', false);

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    marketplaceDb: mongoose.connection.readyState === 1,
    pharmacyDb: pharmacyDb.readyState === 1,
    time: new Date().toISOString(),
  });
});

app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/audit', auditRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin not allowed by CORS') return res.status(403).json({ message: error.message });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  console.error('Unhandled error:', error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MarketPlace MongoDB'))
  .catch((err) => console.error('MarketPlace MongoDB connection error:', err.message));

pharmacyDb.on('connected', () => console.log('Connected to Pharmacy MongoDB'));
pharmacyDb.on('error', (err) => console.error('Pharmacy MongoDB connection error:', err.message));

app.listen(PORT, () => {
  console.log(`Admin API listening on port ${PORT} (allowed origins: ${allowedOrigins.join(', ')})`);
});
