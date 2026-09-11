import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { rescueService } from './rescue.service';

export const rescueRouter = Router();

rescueRouter.get('/targets', requireAuth, requireRole('VOLUNTEER', 'RESPONDER_ADMIN'), async (_req, res, next) => {
  try {
    res.json({ success: true, targets: await rescueService.listActiveTargets() });
  } catch (error) {
    next(error);
  }
});

rescueRouter.get('/help/:requestId/status', requireAuth, async (req, res, next) => {
  try {
    const requesterNodeId = req.user?.userId.startsWith('mobile-')
      ? req.user.userId.slice('mobile-'.length)
      : undefined;
    if (!requesterNodeId) {
      res.status(403).json({ success: false, error: 'This help request belongs to another device.' });
      return;
    }
    const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
    if (!requestId) {
      res.status(400).json({ success: false, error: 'Help request ID is required.' });
      return;
    }
    const status = await rescueService.getRequesterStatus(requestId, requesterNodeId);
    if (!status) {
      res.status(404).json({ success: false, error: 'Help request not found for this device.' });
      return;
    }
    res.json({ success: true, status });
  } catch (error) {
    next(error);
  }
});
