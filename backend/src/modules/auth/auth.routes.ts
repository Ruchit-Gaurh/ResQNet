import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

export const authRouter = Router();

const VALID_ROLES = ['FAMILY', 'PUBLIC', 'VOLUNTEER', 'HOSPITAL', 'RELIEF_CAMP', 'RESPONDER_ADMIN'];

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
