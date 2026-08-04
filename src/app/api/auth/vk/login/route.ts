import { NextRequest, NextResponse } from "next/server";

const VK_APP_ID = process.env.VK_APP_ID || "YOUR_VK_APP_ID";
const REDIRECT_URI = "https://sakhgo.ru/api/auth/vk/callback";

function base64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** GET /api/auth/vk/login — PKCE + redirect to VK ID */
export async function GET(req: NextRequest) {
  // PKCE: generate code_verifier (43-128 random chars, base64url)
  const verifierBytes = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64url(verifierBytes);

  // SHA-256 hash of verifier = code_challenge
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(new Uint8Array(digest));

  // Anti-CSRF state
  const state = crypto.randomUUID();

  // Build VK auth URL
  const url = new URL("https://id.vk.com/auth");
  url.searchParams.set("app_id", VK_APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email phone");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("v", "5.199");

  const res = NextResponse.redirect(url);

  // Store PKCE verifier + state for callback
  const pckeStore = JSON.stringify({ verifier: codeVerifier, state });
  res.cookies.set("vk_pkce", pckeStore, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });

  return res;
}
