import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { publicError } from '../../backend/utils/publicError';

export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  getDashboard = async (_req: Request, res: Response) => {
    try {
      const data = await this.adminService.getDashboardData();
      res.status(200).json(data);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل تحميل لوحة التحكم') });
    }
  };

  getAllUsers = async (_req: Request, res: Response) => {
    try {
      const users = await this.adminService.getAllUsers();
      res.status(200).json(users);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب المستخدمين') });
    }
  };

  createUser = async (req: Request, res: Response) => {
    try {
      const user = await this.adminService.createUser(req.body);
      res.status(201).json({ user, message: 'تم إنشاء المستخدم بنجاح' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إنشاء المستخدم') });
    }
  };

  banUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.adminService.banUser(id);
      res.status(200).json({ message: 'User banned' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الحظر') });
    }
  };

  unbanUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.adminService.unbanUser(id);
      res.status(200).json({ message: 'User unbanned' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إلغاء الحظر') });
    }
  };

  approveUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.adminService.approveUser(id);
      res.status(200).json({ message: 'User approved' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الموافقة') });
    }
  };

  renewSubscription = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { months } = req.body;
      await this.adminService.renewSubscription(id, Number(months || 1));
      res.status(200).json({ message: 'Subscription renewed' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل التجديد') });
    }
  };

  manageEquipment = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await this.adminService.updateEquipmentStatus(id, status);
      res.status(200).json({ message: 'Equipment status updated' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل تحديث المعدّة') });
    }
  };

  getAllBookings = async (_req: Request, res: Response) => {
    try {
      const bookings = await this.adminService.getAllBookings();
      res.status(200).json(bookings);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الحجوزات') });
    }
  };

  updateBookingStatus = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.params;
      const status = String(req.body?.status || '');
      await this.adminService.updateBookingStatus(id, status, actor.userId);
      res.status(200).json({ message: 'تم تحديث الحجز' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل تحديث الحجز') });
    }
  };

  listEquipment = async (_req: Request, res: Response) => {
    try {
      const rows = await this.adminService.listAllEquipment();
      res.status(200).json(rows);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب المعدات') });
    }
  };

  getAllPayments = async (_req: Request, res: Response) => {
    try {
      const payments = await this.adminService.getAllPayments();
      res.status(200).json(payments);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب المدفوعات') });
    }
  };

  getSettings = async (_req: Request, res: Response) => {
    try {
      const settings = await this.adminService.getPlatformSettings();
      res.status(200).json(settings);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الإعدادات') });
    }
  };

  updateSettings = async (req: Request, res: Response) => {
    try {
      await this.adminService.updatePlatformSettings(req.body);
      res.status(200).json({ message: 'Settings updated' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل حفظ الإعدادات') });
    }
  };

  deleteUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.adminService.deleteUser(id);
      res.status(204).send();
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الحذف') });
    }
  };

  reviewPayment = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { approve, notes } = req.body;
      await this.adminService.reviewPayment(id, approve, notes);
      res.status(200).json({ message: `Payment ${approve ? 'approved' : 'rejected'}` });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل مراجعة الدفع') });
    }
  };

  getPasswordResetRequests = async (_req: Request, res: Response) => {
    try {
      const list = await this.adminService.getPasswordResetRequests();
      res.status(200).json(list);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الطلبات') });
    }
  };

  reviewPasswordResetRequest = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.params;
      const { approve, notes } = req.body;
      const result = await this.adminService.reviewPasswordResetRequest(
        actor.userId,
        id,
        Boolean(approve),
        notes
      );
      res.status(200).json({
        message: `Reset request ${approve ? 'approved' : 'rejected'}`,
        completionToken: result.completionToken,
      });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل مراجعة الطلب') });
    }
  };

  getPartnerPaymentsReport = async (_req: Request, res: Response) => {
    try {
      const report = await this.adminService.getPartnerPaymentsReport();
      res.status(200).json(report);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل تقرير الشركاء') });
    }
  };

  getReadiness = async (_req: Request, res: Response) => {
    try {
      const { getReadinessReport } = await import('../../backend/services/readiness.service');
      const report = await getReadinessReport();
      res.status(report.ready ? 200 : 503).json(report);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل فحص الجاهزية') });
    }
  };
}
