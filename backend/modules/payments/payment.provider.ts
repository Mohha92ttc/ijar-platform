import { CreatePaymentDTO, PaymentResponse } from './payment.types';

export interface IPaymentProvider {
  name: string;
  processPayment(data: CreatePaymentDTO): Promise<PaymentResponse>;
  refundPayment(paymentId: string): Promise<boolean>;
}
