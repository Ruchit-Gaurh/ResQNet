import { Request, Response, NextFunction } from 'express';
import { casesService } from './cases.service';

export const casesController = {
  async createMissing(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await casesService.createMissingCase(req.body, req.user!.userId);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createFound(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await casesService.createFoundCase(req.body, req.user!.userId);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getCase(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.caseId as string;
      // Use authenticated role; fall back to query param for backward compat
      const roleParam = req.query.role;
      const role = req.user?.role || (typeof roleParam === 'string' ? roleParam : 'PUBLIC');
      const result = await casesService.getCaseById(caseId, role);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async listCases(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, status, zone } = req.query;
      const roleParam = req.query.role;
      const role = req.user?.role || (typeof roleParam === 'string' ? roleParam : 'PUBLIC');
      const cases = await casesService.listCases(
        {
          type: typeof type === 'string' ? type : undefined,
          status: typeof status === 'string' ? status : undefined,
          zone: typeof zone === 'string' ? zone : undefined,
        },
        role
      );
      res.json({ success: true, cases });
    } catch (error) {
      next(error);
    }
  },
};
