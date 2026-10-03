// Phone numbers are free-typed at checkout with no format enforced (see
// app/checkout/page.tsx) — admins may see local Egyptian numbers
// ("01098264079"), numbers already carrying the country code
// ("201098264079" / "+201098264079"), or anything in between. wa.me needs
// digits only, in full international form, so this normalizes the common
// Egyptian cases and otherwise falls back to the digits as typed.
function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${toWhatsAppDigits(phone)}?${params.toString()}`;
}
