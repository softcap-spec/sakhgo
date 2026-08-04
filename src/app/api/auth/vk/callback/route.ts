import { NextRequest, NextResponse } from "next/server";

const VK_APP_ID = process.env.VK_APP_ID || "YOUR_VK_APP_ID";
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || "";
const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN || "";
const REDIRECT_URI = "https://sakhgo.ru/api/auth/vk/callback";

const VK_API = {
  token: "https://id.vk.com/oauth2/auth",
  exchange: "https://id.vk.com/oauth2/token",
  userInfo: "https://id.vk.com/oauth2/user_info",
};

/**
 * GET /api/auth/vk/callback
 * VK ID возвращает code + device_id. Обмениваем на access_token,
 * затем получаем данные пользователя: user_id, first_name, last_name, email, phone.
 *
 * После успешной авторизации редиректим на главную с токеном VK.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const deviceId = url.searchParams.get("device_id");
  const state = url.searchParams.get("state");
  const storedState = req.cookies.get("vk_auth_state")?.value;

  // CSRF check
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }

  if (!code || !deviceId) {
    return NextResponse.redirect(new URL("/?error=no_auth_code", req.url));
  }

  try {
    // 1. Exchange code → access_token
    const tokenRes = await fetch(VK_API.exchange, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code_verifier: "auto_generated", // in prod: store and use PKCE verifier
        code,
        client_id: VK_APP_ID,
        client_secret: VK_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        device_id: deviceId,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("VK token exchange error:", tokenData);
      return NextResponse.redirect(new URL("/?error=vk_token", req.url));
    }

    const accessToken = tokenData.access_token;

    // 2. Get user info
    const userRes = await fetch(`${VK_API.userInfo}?client_id=${VK_APP_ID}&access_token=${accessToken}`);
    const userData = await userRes.json();

    if (userData.error) {
      console.error("VK user info error:", userData);
      return NextResponse.redirect(new URL("/?error=vk_user_info", req.url));
    }

    // 3. Build user profile from VK data
    const vkUser = userData.user;
    const profile = {
      vkId: String(vkUser.user_id),
      name: `${vkUser.first_name ?? ""} ${vkUser.last_name ?? ""}`.trim(),
      email: vkUser.email ?? `${vkUser.user_id}@vk.com`,
      phone: vkUser.phone ?? "",
      phoneVerified: !!vkUser.phone,
    };

    // 4. Set cookie with VK session data (in production: create proper JWT/Supabase session)
    const res = NextResponse.redirect(new URL("/?vk_auth=ok", req.url));
    res.cookies.set("vk_session", JSON.stringify(profile), {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 86400 * 7, path: "/",
    });
    res.cookies.delete("vk_auth_state");

    return res;
  } catch (err) {
    console.error("VK callback error:", err);
    return NextResponse.redirect(new URL("/?error=vk_callback_failed", req.url));
  }
}
