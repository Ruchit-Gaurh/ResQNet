import { Request, Response, NextFunction } from 'express';
import { sightingsService } from './sightings.service';

export const sightingsController = {
  async createSighting(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await sightingsService.createSighting(
        req.body,
        req.user!.userId,
        req.user!.pseudonym
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
};
