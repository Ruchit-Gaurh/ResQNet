import { Request, Response, NextFunction } from 'express';
import { syncService } from './sync.service';

export const syncController = {
  async processBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await syncService.processBatch(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
