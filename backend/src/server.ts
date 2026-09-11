import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';

// Module routes
import { casesRouter } from './modules/cases/cases.routes';
import { sightingsRouter } from './modules/sightings/sightings.routes';
import { safeCheckinRouter } from './modules/safe-checkin/safe-checkin.routes';
import { syncRouter } from './modules/sync/sync.routes';
import { verificationRouter } from './modules/verification/verification.routes';
import { authRouter } from './modules/auth/auth.routes';

const app = express();

// ==========================================
// Global Middleware
// ==========================================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support base64 photos

// ==========================================
// Health Check
// ==========================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'resqnet-backend', timestamp: new Date().toISOString() });
});

// ==========================================
// API Routes (v1)
// ==========================================
app.use('/api/v1/cases', casesRouter);
app.use('/api/v1/reports', sightingsRouter);
app.use('/api/v1', safeCheckinRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/admin', verificationRouter);
app.use('/api/v1/auth', authRouter);

// ==========================================
// 404 Handler
// ==========================================
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ==========================================
// Centralized Error Handler
// ==========================================
app.use(errorHandler);

// ==========================================
// Start Server
// ==========================================
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 RESQNET Backend running on port ${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
  });
}

export default app;
