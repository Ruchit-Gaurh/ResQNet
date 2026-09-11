import { Request, Response, NextFunction } from 'express';
import { verificationService } from './verification.service';

export const verificationController = {
  async getPendingMatches(_req: Request, res: Response, next: NextFunction) {
    try {
      const matches = await verificationService.getPendingMatches();
      res.json({ success: true, matches });
    } catch (error) {
      next(error);
    }
  },

  async verifyMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const matchId = req.params.matchId as string;
      const result = await verificationService.verifyMatch(
        matchId,
        req.body,
        req.user!.role
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async mergeCases(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await verificationService.mergeCases(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
