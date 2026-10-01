/**
 * Sanitize errors returned to API clients (hide internals in production).
 */
export function publicError(error: unknown, fallback = 'تعذر تنفيذ العملية'): string {
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    const msg = error.message || '';
    // allow known safe Arabic/business messages
    if (
      msg.includes('غير') ||
      msg.includes('مطلوب') ||
      msg.includes('فشل') ||
      msg.includes('صلاح') ||
      msg.includes('كلمة المرور') ||
      msg.includes('Password') ||
      msg.includes('Invalid') ||
      msg.includes('not found') ||
      msg.includes('Unauthorized') ||
      msg.includes('Not allowed') ||
      msg.includes('pending') ||
      msg.includes('يجب') ||
      msg.includes('يرجى') ||
      msg.includes('حجم') ||
      msg.includes('صورة')
    ) {
      return msg;
    }
  }
  return fallback;
}
