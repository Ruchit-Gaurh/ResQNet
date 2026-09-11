import { Request, Response, NextFunction } from 'express';
import { safeCheckinService } from './safe-checkin.service';

export const safeCheckinController = {
  async createCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await safeCheckinService.createCheckIn(
        req.body,
        req.user!.userId,
        req.user!.pseudonym
      );
      // Contract specifies 200 OK for safe check-in
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
