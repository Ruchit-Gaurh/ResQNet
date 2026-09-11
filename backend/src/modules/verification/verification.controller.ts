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

  async getAllMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
      const matches = await verificationService.getAllMatches(statusFilter);
      res.json({ success: true, matches });
    } catch (error) {
      next(error);
    }
  },

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = await verificationService.getAuditLogs(limit);
      res.json({ success: true, logs });
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
