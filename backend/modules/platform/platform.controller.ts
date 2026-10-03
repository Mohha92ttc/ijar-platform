import { Request, Response } from 'express';
import { query } from '../../database/connection';

export class PlatformController {
  /** معلومات التحويل وأسعار الخدمات — للعرض للشركاء قبل الدفع (بدون مصادقة) */
  getTransferInfo = async (_req: Request, res: Response) => {
    try {
      const r = await query(
        `SELECT bank_name, bank_account_iban, card_number_display, zain_cash_phone,
                account_holder_name, transfer_instructions,
                featured_ad_price, featured_duration_days, subscription_renewal_price
         FROM platform_settings WHERE id = 1`
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(200).json({
          bank_name: null,
          bank_account_iban: null,
          card_number_display: null,
          mastercard: null,
          zain_cash_phone: null,
          account_holder_name: null,
          transfer_instructions: null,
          featured_ad_price: 50000,
          featured_duration_days: 30,
          subscription_renewal_price: 100000,
        });
      }
      const mastercard = row.card_number_display ?? null;
      const zain = row.zain_cash_phone ?? null;
      res.status(200).json({
        bank_name: row.bank_name ?? null,
        bank_account_iban: row.bank_account_iban ?? null,
        card_number_display: mastercard,
        /** aliases for clearer UI */
        mastercard,
        zain_cash_phone: zain,
        account_holder_name: row.account_holder_name ?? null,
        transfer_instructions: row.transfer_instructions ?? null,
        featured_ad_price: Number(row.featured_ad_price ?? 50000),
        featured_duration_days: Number(row.featured_duration_days ?? 30),
        subscription_renewal_price: Number(row.subscription_renewal_price ?? 100000),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      res.status(500).json({ message: msg });
    }
  };
}
