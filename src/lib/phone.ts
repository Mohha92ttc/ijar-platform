/** Normalize Iraqi phone to digits for tel:/wa.me (964…). */
export function iraqWaDigits(raw?: string | null): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('964') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `964${digits.slice(1)}`;
  if (digits.length >= 9) return `964${digits}`;
  return null;
}
