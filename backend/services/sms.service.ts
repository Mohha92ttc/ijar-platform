/**
 * Unified SMS: sends via Twilio when configured; otherwise logs (dev) and returns false.
 * Env: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + (TWILIO_FROM_NUMBER | TWILIO_PHONE_NUMBER)
 */
export type SmsPayload = {
  to: string;
  body: string;
};

type TwilioClient = {
  messages: {
    create: (opts: { to: string; from: string; body: string }) => Promise<unknown>;
  };
};

function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  // Iraqi local 07xxxxxxxxx → E.164
  if (/^07\d{9}$/.test(digits)) return `+964${digits.slice(1)}`;
  if (/^964\d+$/.test(digits)) return `+${digits}`;
  return digits;
}

function envConfigured(): { sid: string; token: string; from: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() || '';
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  const from =
    process.env.TWILIO_FROM_NUMBER?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    '';
  if (sid && token && from) return { sid, token, from };
  return null;
}

export class SmsService {
  private clientPromise: Promise<TwilioClient | null> | null = null;
  private fromNumber: string | null = null;

  isConfigured(): boolean {
    return envConfigured() != null;
  }

  private async getClient(): Promise<TwilioClient | null> {
    const cfg = envConfigured();
    if (!cfg) return null;
    this.fromNumber = cfg.from;
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        try {
          const twilioMod = await import('twilio');
          const factory = (twilioMod as { default?: (s: string, t: string) => TwilioClient }).default ||
            (twilioMod as unknown as (s: string, t: string) => TwilioClient);
          return factory(cfg.sid, cfg.token);
        } catch (err) {
          console.warn('[SMS] Twilio init failed:', err instanceof Error ? err.message : err);
          return null;
        }
      })();
    }
    return this.clientPromise;
  }

  async send(payload: SmsPayload): Promise<boolean> {
    const to = normalizePhone(payload.to);
    const body = String(payload.body || '').trim().slice(0, 320);
    if (!to || !body) return false;

    const cfg = envConfigured();
    if (!cfg) {
      console.log(`[SMS:DEV] To=${to} | ${body}`);
      return false;
    }

    try {
      const client = await this.getClient();
      if (!client) {
        console.log(`[SMS:DEV] To=${to} | ${body}`);
        return false;
      }
      await client.messages.create({
        to,
        from: this.fromNumber || cfg.from,
        body,
      });
      return true;
    } catch (err) {
      console.warn('[SMS] send failed:', err instanceof Error ? err.message : err);
      return false;
    }
  }
}

export const smsService = new SmsService();
