import { cookies } from "next/headers";

// Uses the Web Crypto API (globalThis.crypto.subtle) instead of Node's
// `crypto` module so this file works both in Route Handlers (Node runtime)
// and in middleware (Edge runtime) without extra configuration.

const SECRET = process.env.SESSION_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET is not set");
}
const KEY_SECRET = SECRET || "dev-only-insecure-secret-change-me";

// Role is stored as free-form text (matches profiles.role in the DB:
// "admin" | "host" | "vendor" | "traveler" | "banned" | ...).
export type SessionPayload = { userId: string; role: string; exp: number };

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const str = atob(b64 + pad);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

async function getKey() {
  return crypto.subtle.importKey(
    "raw", enc.encode(KEY_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

async function sign(payload: SessionPayload): Promise<string> {
  const data = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Low-level verify. Pure function — safe to call from middleware (Edge runtime) too. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify("HMAC", key, fromBase64Url(sig) as BufferSource, enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(data))) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Route Handlers / Server Components only (uses next/headers). Do not call from middleware. */
export async function createSession(userId: string, role: SessionPayload["role"]) {
  const token = await sign({ userId, role, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  (await cookies()).set("session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get("session")?.value;
  return verifySessionToken(token);
}

export async function clearSession() {
  (await cookies()).delete("session");
}
