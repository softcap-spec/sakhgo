import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET is not set");
}

type SessionPayload = { userId: string; role: "user" | "host" | "admin"; exp: number };

function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET || "dev-only-insecure")
    .update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", SECRET || "dev-only-insecure")
    .update(data).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export async function createSession(userId: string, role: SessionPayload["role"]) {
  const token = sign({ userId, role, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  (await cookies()).set("session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;
  return verify(token);
}

export async function clearSession() {
  (await cookies()).delete("session");
}