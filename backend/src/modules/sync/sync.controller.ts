import { Request, Response, NextFunction } from 'express';
import { syncService } from './sync.service';

export const syncController = {
  async processBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const expectedMobileUserId = `mobile-${req.body.deviceId}`;
      if (req.user?.role !== 'RESPONDER_ADMIN' && req.user?.userId !== expectedMobileUserId) {
        res.status(403).json({
          success: false,
          error: 'The authenticated mobile identity does not match this sync deviceId.',
        });
        return;
      }
      const result = await syncService.processBatch(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
