import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { dbFindProfileByVkId, dbLinkVkId, dbCreateProfileFromVk, dbGetProfile } from "@/lib/db";

const VK_APP_ID = process.env.VK_APP_ID || "YOUR_VK_APP_ID";
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const REDIRECT_URI = "https://sakhgo.ru/api/auth/vk/callback";

const VK_TOKEN_URL = "https://id.vk.com/oauth2/auth";
const VK_USER_INFO = "https://id.vk.com/oauth2/user_info";

/** GET /api/auth/vk/callback — exchange code, get user, create session */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const deviceId = url.searchParams.get("device_id");
  const state = url.searchParams.get("state");

  // Read PKCE data from cookie
  const pkceCookie = req.cookies.get("vk_pkce")?.value;
  if (!pkceCookie) {
    return NextResponse.redirect(new URL("/?error=vk_expired", req.url));
  }

  let pkceData: { verifier: string; state: string };
  try {
    pkceData = JSON.parse(pkceCookie);
  } catch {
    return NextResponse.redirect(new URL("/?error=vk_invalid", req.url));
  }

  // CSRF check
  if (!state || state !== pkceData.state) {
    return NextResponse.redirect(new URL("/?error=vk_csrf", req.url));
  }

  if (!code || !deviceId) {
    return NextResponse.redirect(new URL("/?error=vk_no_code", req.url));
  }

  try {
    // 1. Exchange code + PKCE verifier -> access_token
    const tokenRes = await fetch(VK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code_verifier: pkceData.verifier,
        code,
        client_id: VK_APP_ID,
        client_secret: VK_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        device_id: deviceId,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("VK token exchange error:", tokenData.error, tokenData.error_description || "");
      return NextResponse.redirect(new URL("/?error=vk_token", req.url));
    }

    const accessToken = tokenData.access_token;

    // 2. Get user info from VK
    const userRes = await fetch(
      VK_USER_INFO + "?client_id=" + VK_APP_ID + "&access_token=" + accessToken
    );
    const userData = await userRes.json();

    if (userData.error) {
      console.error("VK user info error:", userData.error, userData.error_description || "");
      return NextResponse.redirect(new URL("/?error=vk_userinfo", req.url));
    }

    const vu = userData.user;
    const vkId = String(vu.user_id);
    const name = (vu.first_name + " " + (vu.last_name || "")).trim();
    const email = vu.email || vkId + "@vk.com";
    const phone = vu.phone || "";

    // 3. Find existing profile or create new one
    let profile = await dbFindProfileByVkId(vkId);

    if (!profile) {
      // Try to match by email (possibly registered with email/password before)
      const emailProfile = await dbGetProfile(email);
      if (emailProfile) {
        profile = emailProfile;
        await dbLinkVkId(profile.id, vkId);
      } else {
        // Create brand new profile from VK data
        profile = await dbCreateProfileFromVk({
          vkId, name, email, phone,
          phoneVerified: !!vu.phone,
        });
      }
    }

    if (!profile) {
      console.error("VK: failed to create/find profile");
      return NextResponse.redirect(new URL("/?error=vk_profile", req.url));
    }

    // 4. Create proper session
    await createSession(profile.id, profile.role || "user");

    // 5. Clean up PKCE cookie, redirect home
    const res = NextResponse.redirect(new URL("/?vk_auth=ok", req.url));
    res.cookies.delete("vk_pkce");
    return res;

  } catch (err) {
    console.error("VK callback error:", err);
    return NextResponse.redirect(new URL("/?error=vk_failed", req.url));
  }
}
