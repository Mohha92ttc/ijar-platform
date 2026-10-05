import { Request, Response } from 'express';
import { EquipmentService } from './equipment.service';

async function resolveOwnerId(
  body: Record<string, unknown>,
  actorUserId?: string,
  actorRole?: string
): Promise<string | null> {
  if (actorRole === 'owner' && actorUserId) {
    return actorUserId;
  }
  if (actorRole === 'admin' && actorUserId) {
    const raw = (body.ownerId ?? body.owner_id) as string | undefined;
    if (raw) return raw;
  }
  return actorUserId || null;
}

export class EquipmentController {
  private equipmentService: EquipmentService;

  constructor() {
    this.equipmentService = new EquipmentService();
  }

  /** Normalize legacy/test field names (name, price) to CreateEquipmentDTO */
  private normalizeCreateBody(body: Record<string, unknown>) {
    const rawPrice = body.price_per_day ?? body.price;
    const price_per_day =
      rawPrice !== undefined && rawPrice !== null && rawPrice !== ''
        ? Number(rawPrice)
        : NaN;
    const governorate = String(body.governorate ?? '').trim();
    const areaRaw = body.area != null ? String(body.area).trim() : '';
    const locationFallback = String(body.location ?? 'بغداد');
    const location =
      governorate
        ? areaRaw
          ? `${governorate} - ${areaRaw}`
          : governorate
        : locationFallback;
    return {
      title: String(body.title ?? body.name ?? ''),
      description: String(body.description ?? ''),
      category: String(body.category ?? ''),
      price_per_day,
      location,
      governorate: governorate || locationFallback.split('-')[0].trim(),
      area: areaRaw || null,
      images: body.images as string[] | undefined,
      pickup_lat:
        body.pickup_lat != null && body.pickup_lat !== '' ? Number(body.pickup_lat) : null,
      pickup_lng:
        body.pickup_lng != null && body.pickup_lng !== '' ? Number(body.pickup_lng) : null,
    };
  }

  list = async (req: Request, res: Response) => {
    try {
      const items = await this.equipmentService.getAll();
      res.status(200).json(items);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  listPartners = async (_req: Request, res: Response) => {
    try {
      const partners = await this.equipmentService.listPublicPartners();
      res.status(200).json(partners);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      const ownerId = await resolveOwnerId(req.body, actor?.userId, actor?.role);
      if (!ownerId) {
        return res.status(400).json({ error: 'يجب تسجيل الدخول كشريك لإضافة معدة' });
      }
      const dto = this.normalizeCreateBody(req.body);
      const equipment = await this.equipmentService.create(ownerId, dto);
      res.status(201).json(equipment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      const ownerId = await resolveOwnerId(req.body, actor?.userId, actor?.role);
      if (!ownerId) {
        return res.status(400).json({ error: 'ownerId required' });
      }
      const equipment = await this.equipmentService.update(id, ownerId, req.body);
      res.status(200).json(equipment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      const ownerId = await resolveOwnerId(req.body, actor?.userId, actor?.role);
      if (!ownerId) {
        return res.status(400).json({ error: 'ownerId required' });
      }
      await this.equipmentService.delete(id, ownerId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (actor?.role === 'admin' || actor?.role === 'courier') {
        const equipment = await this.equipmentService.getById(id);
        return res.status(200).json(equipment);
      }
      if (actor?.role === 'owner' && actor.userId) {
        const equipment = await this.equipmentService.getById(id);
        if (equipment.owner_id === actor.userId) {
          return res.status(200).json(equipment);
        }
      }
      const equipment = await this.equipmentService.getById(id, { requirePublicOwner: true });
      res.status(200).json(equipment);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  };

  search = async (req: Request, res: Response) => {
    try {
      const filters = {
        query: req.query.query as string,
        category: req.query.category as string,
        location: req.query.location as string,
        governorate: req.query.governorate as string,
        area: req.query.area as string,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };
      const results = await this.equipmentService.search(filters);
      res.status(200).json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getByOwner = async (req: Request, res: Response) => {
    try {
      const { ownerId } = req.params;
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      const self = actor?.role === 'owner' && actor.userId === ownerId;
      const admin = actor?.role === 'admin';
      if (self || admin) {
        const items = await this.equipmentService.getByOwner(ownerId);
        return res.status(200).json(items);
      }
      // Public: only if subscription active
      const sub = await this.equipmentService.getByOwner(ownerId);
      const { isSubscriptionActiveRow } = await import('../subscriptions/subscription.policy');
      const { query } = await import('../../database/connection');
      const u = await query(
        `SELECT subscription_status, subscription_end_date FROM users WHERE id = $1 LIMIT 1`,
        [ownerId]
      );
      if (!u.rows[0] || !isSubscriptionActiveRow(u.rows[0])) {
        return res.status(200).json([]);
      }
      res.status(200).json(sub.filter((e) => !['hidden', 'maintenance'].includes(String(e.status))));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getCategories = async (req: Request, res: Response) => {
    try {
      const results = await this.equipmentService.getCategories();
      res.status(200).json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  addCategory = async (req: Request, res: Response) => {
    try {
      const { name, image } = req.body;
      const result = await this.equipmentService.addCategory(name, image);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  deleteCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.equipmentService.deleteCategory(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}
