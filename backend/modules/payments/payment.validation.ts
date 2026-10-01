import { Request, Response, NextFunction } from 'express';

export const validatePaymentRequest = (req: Request, res: Response, next: NextFunction) => {
  const { booking_id, payment_method, amount } = req.body;

  if (!booking_id || !payment_method || !amount) {
    return res.status(400).json({ message: 'Missing required payment fields' });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  if (payment_method === 'manual') {
    const hasProof = req.body.proof_image || req.body.transfer_phone || req.body.transfer_card;
    if (!hasProof) {
      // We allow initiating without proof, but it stays 'pending'
      // However, for certain flows we might require it
    }
  }

  next();
};

export const validateImageUpload = (req: Request, res: Response, next: NextFunction) => {
  // Mock image validation
  // In real app, check mime type and size
  const { proof_image } = req.body;
  if (proof_image && !proof_image.startsWith('data:image/')) {
    // return res.status(400).json({ message: 'Invalid image format' });
  }
  next();
};
