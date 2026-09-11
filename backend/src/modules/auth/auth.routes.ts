import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../../config';

export const authRouter = Router();

const VALID_ROLES = ['FAMILY', 'PUBLIC', 'VOLUNTEER', 'HOSPITAL', 'RELIEF_CAMP', 'RESPONDER_ADMIN'];
const DEVICE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const deviceTokenRequestSchema = z.object({
  deviceId: z.string().trim().regex(/^NODE-[A-F0-9]{8}$/, {
    message: 'deviceId must use the ResQNet NODE-XXXXXXXX format',
  }),
}).strict();

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
