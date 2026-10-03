import { Request, Response } from 'express';
import { BookingService } from './bookings.service';

export class BookingController {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService();
  }

  create = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || actor.role !== 'customer') {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const customerId = actor.userId;
      if (typeof req.body.customerId === 'string' && req.body.customerId !== customerId) {
        return res.status(403).json({ message: 'Customer mismatch' });
      }
      const booking = await this.bookingService.create(customerId, {
        equipment_id: req.body.equipment_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        location: req.body.location,
        notes: req.body.notes,
        customer_phone: req.body.customer_phone,
        delivery_requested: Boolean(req.body.delivery_requested),
        delivery_fee: Number(req.body.delivery_fee) || 0,
        payment_preference: req.body.payment_preference ? String(req.body.payment_preference) : undefined,
      });
      res.status(201).json(booking);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const booking = await this.bookingService.updateStatus(id, status, {
        userId: actor.userId,
        role: actor.role,
      });
      res.status(200).json(booking);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getByCustomer = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { customerId } = req.params;
      if (actor.role === 'customer' && customerId !== actor.userId) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      const bookings = await this.bookingService.getByCustomer(customerId);
      res.status(200).json(bookings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getByEquipment = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { equipmentId } = req.params;
      const bookings = await this.bookingService.getByEquipment(equipmentId);
      const filtered =
        actor.role === 'customer' ? bookings.filter((b: any) => String(b.customer_id) === actor.userId) : bookings;
      res.status(200).json(filtered);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;
      const booking = await this.bookingService.getById(id);
      if (actor.role === 'customer' && booking.customer_id !== actor.userId) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      res.status(200).json(booking);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  };

  getByOwner = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { ownerId } = req.params;
      if (actor.role === 'owner' && ownerId !== actor.userId) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      const bookings = await this.bookingService.getByOwner(ownerId);
      res.status(200).json(bookings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}
