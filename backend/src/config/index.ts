import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  isDev: nodeEnv !== 'production',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
  },

  admin: {
    accessKey: process.env.ADMIN_ACCESS_KEY || (nodeEnv === 'production' ? undefined : 'resqnet-local-admin'),
  },

  matching: {
    thresholdStrong: parseInt(process.env.MATCH_THRESHOLD_STRONG || '80', 10),
    thresholdPossible: parseInt(process.env.MATCH_THRESHOLD_POSSIBLE || '60', 10),
    thresholdWeak: parseInt(process.env.MATCH_THRESHOLD_WEAK || '40', 10),
  },
} as const;
