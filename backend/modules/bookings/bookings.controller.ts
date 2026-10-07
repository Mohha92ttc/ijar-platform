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
        waive_delivery_fee: Boolean(req.body.waive_delivery_fee),
        delivery_lat: req.body.delivery_lat != null ? Number(req.body.delivery_lat) : null,
        delivery_lng: req.body.delivery_lng != null ? Number(req.body.delivery_lng) : null,
        delivery_address: req.body.delivery_address ? String(req.body.delivery_address) : null,
        payment_preference: req.body.payment_preference ? String(req.body.payment_preference) : undefined,
        discount_code: req.body.discount_code ? String(req.body.discount_code) : undefined,
      });
      res.status(201).json(booking);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, reason, cancel_reason } = req.body;
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId || !actor.role) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const booking = await this.bookingService.updateStatus(
        id,
        status,
        {
          userId: actor.userId,
          role: actor.role,
        },
        { reason: reason || cancel_reason }
      );
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
      if (actor.role === 'owner') {
        const allowed = await this.bookingService.ownerOwnsEquipment(actor.userId, equipmentId);
        if (!allowed) {
          return res.status(403).json({ message: 'Not allowed' });
        }
      }
      const bookings = await this.bookingService.getByEquipment(equipmentId);
      const filtered =
        actor.role === 'customer'
          ? bookings.filter((b: any) => String(b.customer_id) === actor.userId)
          : bookings;
      res.status(200).json(filtered);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  checkAvailability = async (req: Request, res: Response) => {
    try {
      const equipmentId = String(req.query.equipment_id || '');
      const start = String(req.query.start || '');
      const end = String(req.query.end || '');
      if (!equipmentId || !start || !end) {
        return res.status(400).json({ message: 'equipment_id و start و end مطلوبة' });
      }
      const startDate = new Date(`${start}T12:00:00`);
      const endDate = new Date(`${end}T12:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'تواريخ غير صالحة' });
      }
      const detail = await this.bookingService.getAvailabilityDetail(equipmentId, startDate, endDate);
      res.status(200).json(detail);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getBusyRanges = async (req: Request, res: Response) => {
    try {
      const equipmentId = String(req.query.equipment_id || '');
      if (!equipmentId) {
        return res.status(400).json({ message: 'equipment_id مطلوب' });
      }
      const fromRaw = req.query.from ? String(req.query.from) : '';
      const toRaw = req.query.to ? String(req.query.to) : '';
      const from = fromRaw ? new Date(`${fromRaw}T12:00:00`) : undefined;
      const to = toRaw ? new Date(`${toRaw}T12:00:00`) : undefined;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        return res.status(400).json({ message: 'تواريخ غير صالحة' });
      }
      const ranges = await this.bookingService.getBusyRanges(equipmentId, from, to);
      res.status(200).json({ ranges });
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
      if (actor.role === 'customer' && String(booking.customer_id) !== String(actor.userId)) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      if (actor.role === 'owner') {
        const allowed = await this.bookingService.ownerOwnsEquipment(actor.userId, booking.equipment_id);
        if (!allowed) {
          return res.status(403).json({ message: 'Not allowed' });
        }
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
