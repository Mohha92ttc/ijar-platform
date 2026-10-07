import { Request, Response } from 'express';
import { ReviewService } from './reviews.service';

export class ReviewController {
  private reviewService: ReviewService;

  constructor() {
    this.reviewService = new ReviewService();
  }

  create = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const review = await this.reviewService.create(actor.userId, req.body);
      res.status(201).json(review);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getByEquipment = async (req: Request, res: Response) => {
    try {
      const { equipmentId } = req.params;
      const reviews = await this.reviewService.getByEquipment(equipmentId);
      res.status(200).json(reviews);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getByOwner = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { ownerId } = req.params;
      if (actor.role === 'owner' && String(ownerId) !== String(actor.userId)) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      const reviews = await this.reviewService.getByOwner(ownerId);
      res.status(200).json(reviews);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const review = await this.reviewService.getById(id);
      res.status(200).json(review);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  };
}
