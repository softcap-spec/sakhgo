import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pg";
import { sendTgNotification, isTgConfigured } from "@/lib/notify";
import { getSession, createSession, clearSession } from "@/lib/session";
import { sanitizeUser } from "@/lib/db";
import {
  dbGetAdminStats, dbSearchProfiles, dbUpdateUserRole, dbGetProfile, dbLogin, dbCreateProfile, dbUpdateProfile, dbGetAllProfiles,
  dbChangePassword,
  dbVerifyPhone, dbGenerateVerificationCode,
  dbGetPublicListings, dbGetPublicListingsCount, dbGetListingById, dbGetListingByIdAdmin, dbGetHostListingById,
  dbGetMyListings, dbAddListing, dbUpdateListing, dbGetAllListings, dbAdminUpdateListing,
  dbApproveListing, dbRemoveListing,
  dbAddListingImage, dbRemoveListingImage, dbGetListingImages,
  dbGetMyBookings, dbAddBooking, dbUpdateBookingStatus,
  dbGetBanners, dbAddBanner, dbUpdateBanner, dbRemoveBanner,
  dbGetPendingEdits, dbAddPendingEdit, dbApproveEdit, dbRejectEdit,
  dbGetHelpContent, dbSetHelpContent,
  dbGetAdminNotifications, dbGetUnreadNotificationCount,
  dbMarkNotificationRead, dbMarkAllNotificationsRead,
  dbGetReviews, dbAddReview, dbGetPendingReviews, dbModerateReview,
  dbGetQuickPickCounts,
  dbGetCrossSell,
  dbSendMessage, dbGetMessages, dbGetChatList, dbMarkMessagesRead,
  dbGetEmailNotificationPref, dbSetEmailNotificationPref,
  dbGetListingStats, dbGetHostStats, dbGetHostListingStats, dbIncrementListingViews,
  dbGetAllPromotions, dbGetPromoPricing, dbUpdatePromoPricing, dbUpdatePromotionStatus, dbCreatePromotion, dbApplyListingPromo, dbGetPromoStats, dbInitPromoPayment,
  dbExpirePromotions,
  dbGetMyPromotions, dbIncrementPromoStats,
  dbCreateEmailVerificationCode, dbVerifyEmail,
  dbCreatePasswordResetToken, dbResetPassword,
} from "@/lib/db";

export const dynamic = "force-dynamic";

// Actions that require an authenticated admin session.
const ADMIN_ONLY = new Set([
  "getAllProfiles", "getAllListings", "getListingByIdAdmin", "adminUpdateListing", "approveListing", "updateUserRole",
  "moderateReview", "getPendingReviews", "updatePromoPricing", "updatePromotionStatus",
  "getAllPromotions", "getPromoStats", "expirePromotions", "createPromotion",
  "getAdminNotifications", "getUnreadCount", "markNotificationRead", "markAllNotificationsRead",
  "addBanner", "updateBanner", "removeBanner",
  "getPendingEdits", "approveEdit", "rejectEdit", "setHelpContent",
  "getAllProfiles",
  "createMessagesTable", // one-off migration action — TODO: move to a real migration script
  "testTgNotification",
  "searchProfiles",
  "getAdminStats",
]);

// Actions that operate on "my own" resource: the given param must match the
// logged-in user's id (or the caller must be an admin).
const OWNER_PARAM: Record<string, string> = {
  deleteProfile: "userId",
  changePassword: "id",
  updateProfile: "id",
  getMyListings: "hostId",
  addListing: "hostId",
  applyListingPromo: "hostId",
  addPendingEdit: "hostId",
  initPromoPayment:  "hostId",
  addBooking: "guestId",
  addReview: "guestId",
  updateListing: "hostId",
  removeListing: "hostId",
  getHostListingById: "hostId",
  getMyBookings: "guestId",
  getHostStats: "hostId",
  getHostListingStats: "hostId",
  getMyPromotions: "hostId",
  getEmailNotificationPref: "userId",
  setEmailNotificationPref: "userId",
  getTgNotificationPref: "userId",
  setTgNotificationPref: "userId",
  sendMessage: "senderId",
  getMessages: "userId",
  getChatList: "userId",
  markMessagesRead: "userId",
};


/** Verify the session user owns the listing (or is admin). Fails closed. */
async function verifyListingOwner(session: { userId: string; role: string } | null, listingId: string): Promise<boolean> {
  if (!session) return false;
  if (session.role === "admin") return true;
  const { rows } = await pool.query("SELECT host_id FROM listings WHERE id = $1", [listingId]);
  return rows.length > 0 && rows[0].host_id === session.userId;
}

/** Verify the session user is a participant (guest or host) of the booking. */
async function verifyBookingParticipant(session: { userId: string; role: string } | null, bookingId: string): Promise<boolean> {
  if (!session) return false;
  if (session.role === "admin") return true;
  const { rows } = await pool.query(
    "SELECT guest_id, host_id FROM bookings WHERE id = $1", [bookingId]
  );
  if (rows.length === 0) return false;
  return rows[0].guest_id === session.userId || rows[0].host_id === session.userId;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, params: explicitParams, ...rest } = body;
    const params: any = explicitParams !== undefined ? explicitParams : rest;
    const session = await getSession();

    if (ADMIN_ONLY.has(action) && session?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (action in OWNER_PARAM) {
      const requestedId = params[OWNER_PARAM[action]];
      const allowed = session && (session.userId === requestedId || session.role === "admin");
      if (!allowed) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
  }

  // gated actions: listing owner
  if (action === "addListingImage" || action === "removeListingImage") {
    const ok = await verifyListingOwner(session, params.listingId);
    if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  // gated actions: booking participant
  if (action === "updateBookingStatus") {
    const ok = await verifyBookingParticipant(session, params.id);
    if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  // session-required
  if (action === "incrementPromoClick" && !session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

    switch (action) {

      // ── Auth ──
      // ── Session check (current user) ──
      case "getMe": {
        if (!session) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
        const { rows: [me] } = await pool.query(
          "SELECT id, name, email, phone, phone_verified, role, avatar_url, vk_id FROM profiles WHERE id = $1",
          [session.userId]
        );
        return NextResponse.json({ ok: true, data: me || null });
      }

      case "login": {
        const user = await dbLogin(params.email, params.password || "");
        if (!user) return NextResponse.json({ ok: false, error: "Неверный email или пароль" });
        await createSession(user.id, user.role || "user");
        return NextResponse.json({ ok: true, data: sanitizeUser(user) });
      }
      // Password reset
      case "forgotPassword": {
        const resetEntry = await dbCreatePasswordResetToken(params.email);
        if (resetEntry) {
          const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sakhgo.ru"}/reset-password?token=${resetEntry.token}`;
          const { sendPasswordResetEmail } = await import("@/lib/email");
          await sendPasswordResetEmail(resetEntry.email, resetEntry.name, resetUrl);
        }
        return NextResponse.json({ ok: true, message: "Если email зарегистрирован, ссылка отправлена." });
      }
      case "verifyEmail": {
        if (!params.token) {
          return NextResponse.json({ ok: false, error: "Токен подтверждения обязателен" });
        }
        const vUser = await dbVerifyEmail(params.token as string);
        if (!vUser) {
          return NextResponse.json({ ok: false, error: "Ссылка недействительна или истекла" });
        }
        return NextResponse.json({ ok: true, data: vUser, message: "Email подтверждён" });
      }
      case "resetPassword": {
        if (!params.token || !params.password) {
          return NextResponse.json({ ok: false, error: "Токен и новый пароль обязательны" });
        }
        if ((params.password as string).length < 6) {
          return NextResponse.json({ ok: false, error: "Пароль должен быть не менее 6 символов" });
        }
        const rpUser = await dbResetPassword(params.token as string, params.password as string);
        if (!rpUser) {
          return NextResponse.json({ ok: false, error: "Ссылка недействительна или истекла. Запросите новую." });
        }
        return NextResponse.json({ ok: true, message: "Пароль успешно изменён" });
      }

      case "register": {
        const existing = await dbGetProfile(params.email);
        if (existing) return NextResponse.json({ ok: false, error: "Email уже зарегистрирован" });
        // Check phone uniqueness
        if (params.phone) {
          const phoneCheck = await pool.query("SELECT id FROM profiles WHERE phone = $1", [params.phone]);
          if (phoneCheck.rows.length > 0) return NextResponse.json({ ok: false, error: "Номер телефона уже зарегистрирован" });
        }
        const user = await dbCreateProfile({
          name: params.name, email: params.email, phone: params.phone || "", password: params.password
        });

        // Generate email verification code and send email
        const vEntry = await dbCreateEmailVerificationCode(params.email);
        if (vEntry) {
          const { sendEmailVerification } = await import("@/lib/email");
          await sendEmailVerification(vEntry.email, vEntry.name, vEntry.token);
        }

        await createSession(user.id, user.role || "user");
        return NextResponse.json({ ok: true, data: sanitizeUser(user), message: "Проверьте email для подтверждения" });
      }
      case "logout": {
        await clearSession();
        return NextResponse.json({ ok: true });
      }
      case "updateProfile": {
        const user = await dbUpdateProfile(params.id, params.data);
        return NextResponse.json({ ok: true, data: sanitizeUser(user) });
      }

      case "getEmailNotificationPref": {
        const pref = await dbGetEmailNotificationPref(params.userId);
        return NextResponse.json({ ok: true, data: pref });
      }
      case "setEmailNotificationPref": {
        await dbSetEmailNotificationPref(params.userId, params.enabled);
        return NextResponse.json({ ok: true });
      }
      case "deleteProfile": {
        await pool.query("DELETE FROM profiles WHERE id = $1", [params.userId]);
        return NextResponse.json({ ok: true });
      }

      case "changePassword": {
        const result = await dbChangePassword(params.id, params.currentPassword, params.newPassword);
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error });
        return NextResponse.json({ ok: true, data: true });
      }

      // ── Phone Verification ──
      case "verifyPhone": {
        const result = await dbVerifyPhone(params.email, params.code);
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error });
        return NextResponse.json({ ok: true, data: true });
      }
      case "generateVerificationCode": {
        const result = await dbGenerateVerificationCode(params.email);
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error });
        return NextResponse.json({ ok: true, data: result.code });
      }

      // ── Public listings (catalog) ──
      case "getPublicListings": {
        const listings = await dbGetPublicListings(params);
        const total = await dbGetPublicListingsCount(params);
        return NextResponse.json({ ok: true, data: { listings, total } });
      }
      case "getListingById": {
        const listing = await dbGetListingById(params.id);
        if (!listing) return NextResponse.json({ ok: false, error: "Объявление не найдено" }, { status: 404 });
        // Increment view count in stats table (fire-and-forget)
        dbIncrementListingViews(params.id).catch(() => {});
        // Increment promo impressions if listing has an active promo (fire-and-forget)
        if (listing.promo) {
          dbIncrementPromoStats(params.id, "impressions").catch(() => {});
        }
        const images = await dbGetListingImages(params.id);
        return NextResponse.json({ ok: true, data: { ...listing, images } });
      }
      case "getListingByIdAdmin": {
        const listing = await dbGetListingByIdAdmin(params.id);
        if (!listing) return NextResponse.json({ ok: false, error: "Ob'yavlenie ne naydeno" }, { status: 404 });
        const images = await dbGetListingImages(params.id);
        return NextResponse.json({ ok: true, data: { ...listing, images } });
      }


      case "getHostListingById": {
        const hostListing = await dbGetHostListingById(params.id, params.hostId);
        if (!hostListing) return NextResponse.json({ ok: false, error: "Объявление не найдено" }, { status: 404 });
        return NextResponse.json({ ok: true, data: hostListing });
      }

      // ── Host listings ──
      case "getMyListings": {
        const listings = await dbGetMyListings(params.hostId);
        return NextResponse.json({ ok: true, data: listings });
      }
      case "addListing": {
        const listing = await dbAddListing(params);
        // Save images if provided
        if (params.images && Array.isArray(params.images)) {
          for (let i = 0; i < params.images.length; i++) {
            await dbAddListingImage(listing.id, params.images[i], i).catch(() => {});
          }
        }
        return NextResponse.json({ ok: true, data: listing });
      }
      case "applyListingPromo": {
        const promoResult = await dbApplyListingPromo(params.hostId, params.id, params.promo, params.duration);
        if (promoResult && !promoResult.ok) return NextResponse.json(promoResult, { status: 404 });
        return NextResponse.json({ ok: true });
      }

      case "updateListing": {
        await dbUpdateListing(params.id, params.hostId, params.patch);
        // Re-sync images
        if (params.images && Array.isArray(params.images)) {
          import("@/lib/pg").then(({ default: pool }) => {
            pool.query("DELETE FROM listing_images WHERE listing_id = $1", [params.id]).then(() => {
              params.images.forEach((url: string, i: number) => {
                dbAddListingImage(params.id, url, i).catch(() => {});
              });
            }).catch(() => {});
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "approveListing": {
        await dbApproveListing(params.id);
        return NextResponse.json({ ok: true });
      }
      case "removeListing": {
        await dbRemoveListing(params.id, params.hostId);
        return NextResponse.json({ ok: true });
      }

      // ── Images ──
      case "addListingImage": {
        await dbAddListingImage(params.listingId, params.url, params.sortOrder ?? 0);
        return NextResponse.json({ ok: true });
      }
      case "removeListingImage": {
        await dbRemoveListingImage(params.listingId, params.url);
        return NextResponse.json({ ok: true });
      }

      // ── Bookings ──
      case "getMyBookings": {
        const bookings = await dbGetMyBookings(params.guestId);
        return NextResponse.json({ ok: true, data: bookings });
      }
      case "addBooking": {
        const booking = await dbAddBooking(params);
        // Send email + TG notification to host
        if (booking) {
          try {
            const { sendUserEmailNotification, dbUserEmailEnabled } = await import("@/lib/email");
            const { dbGetListingById } = await import("@/lib/db");
            const listing = await dbGetListingById(booking.listing_id);
            if (listing?.host_id) {
              const userPref = await dbUserEmailEnabled(listing.host_id);
              if (userPref && userPref.enabled && userPref.email) {
                const listingTitle = listing.title || "объявление";
                const details = `${booking.guest_name || "Гость"} · ${booking.check_in || ""}–${booking.check_out || ""} · ${booking.guests || 1} чел. · ${booking.total_price || 0} ₽`;
                await sendUserEmailNotification(
                  userPref.email,
                  "booking",
                  listingTitle,
                  booking.guest_name || "Гость",
                  details,
                  `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/listings/${booking.listing_id}`
                );
              }
              // Try to send TG notification to host if they have a chat_id
              try {
                const hostRow = await pool.query(
                  "SELECT telegram_chat_id FROM profiles WHERE id = $1",
                  [listing.host_id]
                );
                if (hostRow.rows[0]?.telegram_chat_id) {
                  const hostTgText = `📅 Новая бронь: ${listing.title || "объявление"}\nГость: ${booking.guest_name || "Гость"}\nДаты: ${booking.check_in || ""} – ${booking.check_out || ""}\nСумма: ${booking.total_price || 0} ₽`;
                  // Use fetch directly to a different chat_id
                  const token = process.env.TELEGRAM_BOT_TOKEN;
                  if (token) {
                    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: hostRow.rows[0].telegram_chat_id,
                        text: `<b>📅 СахGO · Новая бронь</b>\n${hostTgText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`,
                        parse_mode: "HTML",
                      }),
                    }).catch(() => {});
                  }
                }
              } catch { /* TG host notification is best-effort */ }
            }
          } catch (e) { console.error("[api] addBooking notification error:", e); }
        }
        return NextResponse.json({ ok: true, data: booking });
      }
      case "updateBookingStatus": {
        const { rows: [booking] } = await pool.query(
          "SELECT host_id, guest_id FROM bookings WHERE id = $1", [params.id]
        );
        if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
        if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        const isHost = session.userId === booking.host_id;
        const isGuest = session.userId === booking.guest_id;
        // host can confirm/reject, guest can cancel, both can do what host can do for flexibility
        const hostStatuses = new Set(["confirmed", "rejected", "cancelled"]);
        const guestStatuses = new Set(["cancelled"]);
        if (isGuest && !guestStatuses.has(params.status)) {
          return NextResponse.json({ ok: false, error: "Only the host can set this status" }, { status: 403 });
        }
        if (!isHost && !isGuest && session.role !== "admin") {
          return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        await dbUpdateBookingStatus(params.id, params.status);
        return NextResponse.json({ ok: true });
      }

      // ── Banners ──
      case "getBanners": {
        const banners = await dbGetBanners();
        return NextResponse.json({ ok: true, data: banners });
      }
      case "addBanner": {
        const banner = await dbAddBanner(params);
        return NextResponse.json({ ok: true, data: banner });
      }
      case "updateBanner": {
        await dbUpdateBanner(params.id, params.patch);
        return NextResponse.json({ ok: true });
      }
      case "removeBanner": {
        await dbRemoveBanner(params.id);
        return NextResponse.json({ ok: true });
      }

      // ── Pending Edits ──
      case "getPendingEdits": {
        const edits = await dbGetPendingEdits();
        return NextResponse.json({ ok: true, data: edits });
      }
      case "addPendingEdit": {
        const edit = await dbAddPendingEdit(params);
        return NextResponse.json({ ok: true, data: edit });
      }
      case "approveEdit": {
        await dbApproveEdit(params.editId, params.listingId, params.changes);
        return NextResponse.json({ ok: true });
      }
      case "rejectEdit": {
        await dbRejectEdit(params.editId);
        return NextResponse.json({ ok: true });
      }

      // ── Help ──
      case "getHelpContent": {
        const content = await dbGetHelpContent();
        return NextResponse.json({ ok: true, data: content });
      }
      case "setHelpContent": {
        await dbSetHelpContent(params.key, params.value);
        return NextResponse.json({ ok: true });
      }



      case "updateUserRole": {
        const updated = await dbUpdateUserRole(params.id, params.role);
        if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true, data: updated });
      }

      case "searchProfiles": {
        const { search, page = 1, pageSize = 15 } = params;
        const result = await dbSearchProfiles(search || "", page, pageSize);
        return NextResponse.json({ ok: true, data: result });
      }

      case "getAllProfiles": {
        const profiles = await dbGetAllProfiles();
        return NextResponse.json({ ok: true, data: profiles });
      }

      case "getAllListings": {
        const listings = await dbGetAllListings();
        return NextResponse.json({ ok: true, data: listings });
      }

      case "adminUpdateListing": {
        const { id, data } = params as { id: string; data: Record<string, unknown> };
        const updated = await dbAdminUpdateListing(id, data);
        return NextResponse.json({ ok: true, data: updated });
      }

      // ── Reviews ──
      case "getReviews": {
        const reviews = await dbGetReviews(params.listingId as string);
        return NextResponse.json({ ok: true, data: reviews });
      }
      case "addReview": {
        const review = await dbAddReview(params as any);
        return NextResponse.json({ ok: true, data: review });
      }
      case "getPendingReviews": {
        const reviews = await dbGetPendingReviews();
        return NextResponse.json({ ok: true, data: reviews });
      }
      case "moderateReview": {
        await dbModerateReview(params.id as string, params.approved as boolean);
        return NextResponse.json({ ok: true, data: true });
      }

      // ── Admin Notifications ──
      case "getAdminStats": {
        const stats = await dbGetAdminStats();
        return NextResponse.json({ ok: true, data: stats });
      }

      case "getAdminNotifications": {
        const list = await dbGetAdminNotifications();
        return NextResponse.json({ ok: true, data: list });
      }
      case "getUnreadCount": {
        const count = await dbGetUnreadNotificationCount();
        return NextResponse.json({ ok: true, data: count });
      }
      case "markNotificationRead": {
        await dbMarkNotificationRead(params.id as string);
        return NextResponse.json({ ok: true, data: true });
      }
      case "markAllNotificationsRead": {
        await dbMarkAllNotificationsRead();
        return NextResponse.json({ ok: true, data: true });
      }

      // ── Listing Stats ──
      case "getListingStats": {
        if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        const stats = await dbGetListingStats(params.listingId as string, (params.days as number) || 7);
        return NextResponse.json({ ok: true, data: stats });
      }
      case "getHostStats": {
        const host = await dbGetHostStats(params.hostId as string, (params.days as number) || 7);
        return NextResponse.json({ ok: true, data: host });
      }
      case "getHostListingStats": {
        const hsl = await dbGetHostListingStats(params.hostId as string, params.listingId as string, (params.days as number) || 7);
        return NextResponse.json({ ok: true, data: hsl });
      }

      // ── Promotions ──
      case "getAllPromotions": {
        const limit = params.limit ? parseInt(String(params.limit)) : undefined; const promos = await dbGetAllPromotions(limit);
        return NextResponse.json({ ok: true, data: promos });
      }
      case "getPromoPricing": {
        const prices = await dbGetPromoPricing();
        return NextResponse.json({ ok: true, data: prices });
      }
      case "updatePromoPricing": {
        await dbUpdatePromoPricing(params.promoType, params.prices);
        return NextResponse.json({ ok: true });
      }
      case "updatePromotionStatus": {
        await dbUpdatePromotionStatus(params.id, params.status);
        return NextResponse.json({ ok: true });
      }
      case "createPromotion": {
        const pm = await dbCreatePromotion(params);
        return NextResponse.json({ ok: true, data: pm });
      }
      case "initPromoPayment": {
        // Создаёт или возвращает существующую запись promotions (status=draft/pending).
        // После этого клиент вызывает /api/payments/create с полученным promotion_id
        // и получает paymentUrl для редиректа на ЮKassa.
        const promo = await dbInitPromoPayment({
          listing_id:    params.listingId,
          host_id:       params.hostId,
          host_name:     params.hostName ?? "",
          listing_title: params.listingTitle ?? "",
          promo_type:    params.promoType,
          duration_days: params.durationDays ?? 7,
          price:         params.price ?? 0,
        });
        return NextResponse.json({ ok: true, data: promo });
      }
      case "getPromoStats": {
        const stats = await dbGetPromoStats();
        return NextResponse.json({ ok: true, data: stats });
      }
      case "expirePromotions": {
        const expiredIds = await dbExpirePromotions();
        return NextResponse.json({ ok: true, data: { expired: expiredIds } });
      }
      case "getMyPromotions": {
        const promos = await dbGetMyPromotions(params.hostId as string);
        return NextResponse.json({ ok: true, data: promos });
      }
      case "incrementPromoClick": {
        await dbIncrementPromoStats(params.listingId as string, "clicks");
        return NextResponse.json({ ok: true, data: true });
      }

      case "getQuickPickCounts": {
        const counts = await dbGetQuickPickCounts();
        return NextResponse.json({ ok: true, data: counts });
      }
      case "getCrossSell": {
        const items = await dbGetCrossSell(params.listingId as string);
        return NextResponse.json({ ok: true, data: items });
      }
      case "sendMessage": {
        const msg = await dbSendMessage(params.listingId as string, params.senderId as string, params.senderName as string, params.receiverId as string, params.text as string);
        // Send email notification to receiver
        if (params.listingId && params.receiverId) {
          try {
            const { sendUserEmailNotification, dbUserEmailEnabled } = await import("@/lib/email");
            const userPref = await dbUserEmailEnabled(params.receiverId as string);
            if (userPref && userPref.enabled && userPref.email) {
              const { dbGetListingById } = await import("@/lib/db");
              const listing = await dbGetListingById(params.listingId as string);
              const listingTitle = listing?.title || "объявление";
              const msgPreview = (params.text as string).length > 160
                ? (params.text as string).substring(0, 160) + "..."
                : params.text as string;
              await sendUserEmailNotification(
                userPref.email,
                "message",
                listingTitle,
                params.senderName as string,
                msgPreview,
                `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/listings/${params.listingId}`
              );
            }
          } catch (e) { console.error("[api] sendMessage notification error:", e); }
        }
        return NextResponse.json({ ok: true, data: msg });
      }
      case "getMessages": {
        const msgs = await dbGetMessages(params.listingId as string, params.userId as string, params.otherId as string);
        return NextResponse.json({ ok: true, data: msgs });
      }
      case "getChatList": {
        const list = await dbGetChatList(params.userId as string);
        return NextResponse.json({ ok: true, data: list });
      }
      case "markMessagesRead": {
        await dbMarkMessagesRead(params.listingId as string, params.userId as string, params.otherId as string);
        return NextResponse.json({ ok: true, data: true });
      }
      case "createMessagesTable": {
        await pool.query(`
          CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_dialog ON messages(listing_id, sender_id, receiver_id)');
        return NextResponse.json({ ok: true, data: true });
      }

      // ── Telegram Notifications ──
      case "testTgNotification": {
        if (!isTgConfigured()) {
          return NextResponse.json({ ok: false, error: "Telegram не настроен. Установи TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID в .env.local" });
        }
        const ok = await sendTgNotification(
          "test",
          "Тестовое уведомление от SakhGO. Если вы это видите — Telegram-уведомления работают корректно."
        );
        return NextResponse.json({ ok, data: { sent: ok, message: ok ? "Тестовое уведомление отправлено" : "Ошибка отправки" } });
      }
      case "getTgNotificationPref": {
        const { rows } = await pool.query(
          "SELECT COALESCE(tg_notifications, false) as enabled FROM profiles WHERE id = $1",
          [params.userId as string]
        );
        return NextResponse.json({ ok: true, data: rows[0]?.enabled ?? false });
      }
      case "setTgNotificationPref": {
        await pool.query("UPDATE profiles SET tg_notifications = $2 WHERE id = $1", [
          params.userId as string,
          params.enabled as boolean,
        ]);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
