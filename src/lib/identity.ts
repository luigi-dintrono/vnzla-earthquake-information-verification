import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Anonymous voter identity for anti-double-count.
 *
 * On first vote/submit we mint a random id and store it in a signed, HttpOnly
 * cookie. The value persisted in the DB is `voterHash(id)` — a non-reversible
 * HMAC — so we can enforce "one vote per device per report" via a unique
 * constraint without storing anything that identifies a person.
 *
 * Server-only (uses node:crypto + next/headers). Do not import client-side.
 */

const SEP = ".";
export const VOTER_COOKIE = "vv_voter";
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function hmac(value: string): string {
  return createHmac("sha256", env.cookieSecret).update(value).digest("hex");
}

export function signVoterId(id: string): string {
  return `${id}${SEP}${hmac(id)}`;
}

export function verifyVoterCookie(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const id = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = hmac(id);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

/** Stable, non-reversible key stored in the DB to de-duplicate votes. */
export function voterHash(id: string): string {
  return hmac(`voter:${id}`).slice(0, 40);
}

export interface Voter {
  id: string;
  hash: string;
}

/** Read the current voter from the cookie (no mutation). Safe in Server Components. */
export async function getVoter(): Promise<Voter | null> {
  const store = await cookies();
  const id = verifyVoterCookie(store.get(VOTER_COOKIE)?.value);
  if (!id) return null;
  return { id, hash: voterHash(id) };
}

/**
 * Get the current voter, minting + setting the cookie if absent.
 * Only call from a Route Handler or Server Action (cookie writes are blocked in
 * Server Components).
 */
export async function ensureVoter(): Promise<Voter> {
  const store = await cookies();
  let id = verifyVoterCookie(store.get(VOTER_COOKIE)?.value);
  if (!id) {
    id = randomUUID();
    store.set(VOTER_COOKIE, signVoterId(id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VOTER_COOKIE_MAX_AGE,
    });
  }
  return { id, hash: voterHash(id) };
}
