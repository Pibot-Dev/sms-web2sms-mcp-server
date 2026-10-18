/**
 * Normalize a phone number to WAHA's digits-only international format.
 * Romanian local numbers (07XXXXXXXX) are prefixed with 40.
 */
export function normalizeWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^07\d{8}$/.test(digits)) digits = `4${digits}`;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`Invalid phone number: ${phone}`);
  }
  return digits;
}
