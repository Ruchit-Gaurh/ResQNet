import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { config } from '../../config';

export const authRouter = Router();

const VALID_ROLES = ['FAMILY', 'PUBLIC', 'VOLUNTEER', 'HOSPITAL', 'RELIEF_CAMP', 'RESPONDER_ADMIN'];
const DEVICE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;
const deviceTokenRequestSchema = z.object({
  deviceId: z.string().trim().regex(/^NODE-[A-F0-9]{8}$/, {
    message: 'deviceId must use the ResQNet NODE-XXXXXXXX format',
  }),
}).strict();
const adminTokenRequestSchema = z.object({
  accessKey: z.string().min(16).max(512),
}).strict();

function secretsMatch(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

/**
 * Production-safe, least-privilege authentication for an installed mobile node.
 * POST /api/v1/auth/device
 * Body: { deviceId: "NODE-XXXXXXXX" }
 *
 * This endpoint can only issue PUBLIC tokens bound to the supplied device ID.
 * It cannot mint responder/admin credentials. The sync controller independently
 * verifies that the token identity matches the deviceId in every sync batch.
 */
authRouter.post('/device', (req, res) => {
  const parsed = deviceTokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device authentication request.',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { deviceId } = parsed.data;
  const userId = `mobile-${deviceId}`;
  const role = 'PUBLIC';
  const token = jwt.sign(
    { userId, role, pseudonym: `PSEUDO-${deviceId}` },
    config.jwt.secret,
    { expiresIn: DEVICE_TOKEN_TTL_SECONDS }
  );

  return res.json({
    success: true,
    token,
    role,
    userId,
    expiresInSeconds: DEVICE_TOKEN_TTL_SECONDS,
  });
});

/**
 * Responder dashboard sign-in. The access key is configured only on the
 * backend and exchanged for a short-lived RESPONDER_ADMIN JWT. No JWT signing
 * secret or permanent admin credential is bundled into the dashboard build.
 */
authRouter.post('/admin', (req, res) => {
  const parsed = adminTokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid administrator sign-in request.' });
  }
  if (!config.admin.accessKey) {
    return res.status(503).json({
      success: false,
      error: 'Administrator sign-in is not configured on this deployment.',
    });
  }
  if (!secretsMatch(parsed.data.accessKey, config.admin.accessKey)) {
    return res.status(401).json({ success: false, error: 'Invalid administrator access key.' });
  }

  const userId = 'admin-dashboard';
  const role = 'RESPONDER_ADMIN';
  const token = jwt.sign(
    { userId, role, pseudonym: 'AUTHORIZED-RESPONDER' },
    config.jwt.secret,
    { expiresIn: ADMIN_TOKEN_TTL_SECONDS }
  );
  return res.json({
    success: true,
    token,
    role,
    userId,
    expiresInSeconds: ADMIN_TOKEN_TTL_SECONDS,
  });
});

/**
 * Development-only token generator for testing all role-based flows.
 * POST /api/v1/auth/token
 * Body: { role: UserRole, userId?: string }
 * Returns: { success: true, token: string, role: string, userId: string }
 */
authRouter.post('/token', (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const { role = 'PUBLIC', userId = 'dev-user-001' } = req.body;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  const token = jwt.sign(
    { userId, role, pseudonym: `PSEUDO-${userId}` },
    config.jwt.secret,
    { expiresIn: '24h' }
  );

  res.json({ success: true, token, role, userId });
});
