import { NextRequest, NextResponse } from "next/server";

const VK_APP_ID = process.env.VK_APP_ID || "YOUR_VK_APP_ID";
const VK_SECURE_KEY = process.env.VK_SECURE_KEY || "";
const REDIRECT_URI = "https://sakhgo.ru/api/auth/vk/callback";

/**
 * GET /api/auth/vk/login
 * Редиректит пользователя на страницу авторизации VK ID.
 *
 * scope: email + phone разрешены в настройках приложения VK.
 * state: anti-CSRF токен.
 */
export async function GET(req: NextRequest) {
  const state = crypto.randomUUID();
  const url = new URL("https://id.vk.com/auth");
  url.searchParams.set("app_id", VK_APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email phone");
  url.searchParams.set("state", state);
  url.searchParams.set("v", "5.199");

  const res = NextResponse.redirect(url);
  res.cookies.set("vk_auth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
