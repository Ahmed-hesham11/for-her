import bcrypt from "bcryptjs";
import { argon2Verify } from "hash-wasm";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function isLegacyPasswordHash(hash: string): boolean {
  return hash.startsWith("$argon2");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (isLegacyPasswordHash(hash)) {
      return await argon2Verify({ password, hash });
    }
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | null = null;

export async function verifyAgainstDummyHash(password: string): Promise<boolean> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomUUID());
  }
  return bcrypt.compare(password, await dummyHashPromise);
}
