import argon2 from "argon2";

// Native addon — Node.js only. Never import this module from middleware.ts
// or anything else that runs on the Edge runtime.
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Used by login to run a real verify() against *something* when the email
// isn't found, so a missing-account response takes roughly the same time as
// a wrong-password response — otherwise the timing difference is a
// user-enumeration oracle. Hashed lazily once (a hand-written hash string
// risks being malformed, which would make argon2 reject it instantly
// instead of doing the full computation — defeating the point).
let dummyHashPromise: Promise<string> | null = null;

export async function verifyAgainstDummyHash(password: string): Promise<boolean> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomUUID());
  }
  return argon2.verify(await dummyHashPromise, password);
}
