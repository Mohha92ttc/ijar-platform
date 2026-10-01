import { IPaymentProvider } from '../payment.provider';
import { CreatePaymentDTO, PaymentResponse } from '../payment.types';

export class ManualProvider implements IPaymentProvider {
  name = 'manual';

  async processPayment(data: CreatePaymentDTO): Promise<PaymentResponse> {
    console.log(`Processing Manual payment for booking ${data.booking_id}`);
    
    // Manual payments start as 'under_review' if proof is provided, or 'pending'
    const status = (data.proof_image || data.transfer_phone || data.transfer_card) 
      ? 'under_review' 
      : 'pending';

    return {
      success: true,
      payment_id: `manual_${Math.random().toString(36).substr(2, 9)}`,
      status: status,
      message: status === 'under_review' ? 'Payment is under review by admin' : 'Please upload proof of payment'
    };
  }

  async refundPayment(paymentId: string): Promise<boolean> {
    console.log(`Manual refund requested for ${paymentId}. Admin must process manually.`);
    return true;
  }
}
