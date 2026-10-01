import nodemailer from 'nodemailer';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Unified mailer: sends via SMTP when configured; otherwise logs (dev) and returns false.
 */
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    }
  }

  isConfigured(): boolean {
    return this.transporter != null;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  async send(payload: MailPayload): Promise<boolean> {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@ijar.iq';
    if (!this.transporter) {
      console.log(`[MAIL:DEV] To=${payload.to} | ${payload.subject} | ${payload.text}`);
      return false;
    }
    await this.transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || `<p>${payload.text}</p>`,
    });
    return true;
  }
}

export const mailService = new MailService();
