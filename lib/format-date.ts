// Order/audit timestamps are stored in UTC. Pages render on the server (whose
// timezone is usually UTC), so format with an explicit zone — otherwise the
// hour shown is off and server/browser output can disagree.
export const STORE_TIME_ZONE = "Africa/Cairo";

export function formatDateTime(value: string | number | Date, locale = "ar-EG"): string {
  return new Date(value).toLocaleString(locale, { timeZone: STORE_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string | number | Date, locale?: string): string {
  return new Date(value).toLocaleDateString(locale, { timeZone: STORE_TIME_ZONE });
}
