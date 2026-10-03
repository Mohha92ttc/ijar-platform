import { Request, Response, NextFunction } from 'express';

const TRANSFER_METHODS = new Set([
  'manual',
  'zain_cash',
  'asia_hawala',
  'wallet',
  'bank',
  'online',
  'visa',
]);

export const validatePaymentRequest = (req: Request, res: Response, next: NextFunction) => {
  const { booking_id, payment_method, amount } = req.body;

  if (!booking_id || !payment_method || !amount) {
    return res.status(400).json({ message: 'Missing required payment fields' });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  const method = String(payment_method);
  const isCod = method === 'cash_on_delivery' || method === 'cash';
  if (!isCod && TRANSFER_METHODS.has(method)) {
    const proof = req.body.proof_image || req.body.payment_proof;
    if (!proof || String(proof).length < 20) {
      return res.status(400).json({
        message: 'يرجى إرفاق صورة إثبات التحويل (زين كاش / حوالة / تحويل بنكي) قبل إرسال الطلب',
      });
    }
  }

  next();
};

export const validateImageUpload = (req: Request, res: Response, next: NextFunction) => {
  const proof = req.body.proof_image || req.body.payment_proof;
  if (proof && typeof proof === 'string' && proof.startsWith('data:') && !proof.startsWith('data:image/')) {
    return res.status(400).json({ message: 'صيغة صورة الإثبات غير صالحة' });
  }
  next();
};
