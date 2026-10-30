import { timingSafeEqual } from "node:crypto";

// Bearer-token check for cron endpoints. Fails closed: no secret configured
// (or a too-short one) means every request is rejected.
export function isAuthorizedCron(authorizationHeader: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorizationHeader);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
