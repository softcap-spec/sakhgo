// Client-side API helper — calls /api/store for all DB operations

const BASE = "/api/store";

async function call(action: string, params?: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) throw new Error(`API ${action} failed: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error((json.error as string) || "Unknown error");
  return json.data;
}

// ── Auth ──
/** Get current user from session cookie */
export async function apiGetMe() {
  try {
    const r = await call("getMe", {});
    return r;
  } catch {
    return null;
  }
}

export const apiForgotPassword = (email: string) =>
  call("forgotPassword", { email });
export const apiResetPassword = (token: string, password: string) =>
  call("resetPassword", { token, password });

export const apiLogin = (email: string, password: string) =>
  call("login", { email, password });
export const apiRegister = (name: string, email: string, phone: string, password: string) =>
  call("register", { name, email, phone, password });
export const apiUpdateProfile = (id: string, data: Record<string, unknown>) =>
  call("updateProfile", { id, data });

// ── Phone Verification ──
export const apiVerifyPhone = (email: string, code: string) =>
  call("verifyPhone", { email, code });
export const apiGenerateVerificationCode = (email: string) =>
  call("generateVerificationCode", { email });

// ── Public listings (catalog, no auth needed) ──
export const apiGetPublicListings = (filters?: {
  type?: string; location?: string; search?: string;
  minPrice?: number; maxPrice?: number;
  sort?: string; limit?: number; offset?: number;
}) => call("getPublicListings", filters ?? {});
export const apiGetListingById = (id: string) => call("getListingById", { id });
export const apiGetListingByIdAdmin = (id: string) => call("getListingByIdAdmin", { id });
export const apiGetHostListingById = (id: string, hostId: string) => call("getHostListingById", { id, hostId });

// ── Host listings ──
export const apiGetMyListings = (hostId: string) => call("getMyListings", { hostId });
export const apiAddListing = (params: Record<string, unknown>) => call("addListing", params);
export const apiUpdateListing = (id: string, hostId: string, patch: Record<string, unknown>, images?: string[]) =>
  call("updateListing", { id, hostId, patch, images });
export const apiApproveListing = (id: string) => call("approveListing", { id });
export const apiRemoveListing = (id: string, hostId: string) => call("removeListing", { id, hostId });

// ── Images ──
export const apiAddListingImage = (listingId: string, url: string, sortOrder?: number) =>
  call("addListingImage", { listingId, url, sortOrder });
export const apiRemoveListingImage = (listingId: string, url: string) =>
  call("removeListingImage", { listingId, url });

// ── Bookings ──
export const apiGetMyBookings = (guestId: string) => call("getMyBookings", { guestId });
export const apiAddBooking = (params: Record<string, unknown>) => call("addBooking", params);
export const apiUpdateBookingStatus = (id: string, status: string) =>
  call("updateBookingStatus", { id, status });

// ── Banners ──
export const apiGetBanners = () => call("getBanners");
export const apiAddBanner = (params: Record<string, unknown>) => call("addBanner", params);
export const apiUpdateBanner = (id: string, patch: Record<string, unknown>) =>
  call("updateBanner", { id, patch });
export const apiRemoveBanner = (id: string) => call("removeBanner", { id });

// ── Pending Edits ──
export const apiGetPendingEdits = () => call("getPendingEdits");
export const apiAddPendingEdit = (params: Record<string, unknown>) => call("addPendingEdit", params);
export const apiApproveEdit = (editId: string, listingId: string, changes: Record<string, string>) =>
  call("approveEdit", { editId, listingId, changes });
export const apiRejectEdit = (editId: string) => call("rejectEdit", { editId });

// ── Help ──
export const apiGetHelpContent = () => call("getHelpContent");
export const apiChangePassword = (id: string, currentPassword: string, newPassword: string) =>
  call("changePassword", { id, currentPassword, newPassword });

// ── Admin ──
export const apiGetAllProfiles = () => call("getAllProfiles");
export const apiGetAllListings = () => call("getAllListings");
export const apiAdminUpdateListing = (id: string, data: Record<string, unknown>) =>
  call("adminUpdateListing", { id, data });
export const apiSetHelpContent = (key: string, value: string) =>
  call("setHelpContent", { key, value });

// ── Admin Notifications ──
export const apiGetAdminNotifications = () => call("getAdminNotifications");
export const apiGetUnreadCount = () => call("getUnreadCount");
export const apiMarkNotificationRead = (id: string) => call("markNotificationRead", { id });
export const apiMarkAllNotificationsRead = () => call("markAllNotificationsRead");

// ── Quick Pick Counts ──
export const apiGetQuickPickCounts = () => call("getQuickPickCounts");
export const apiGetCrossSell = (listingId: string) => call("getCrossSell", { listingId });

// ── Reviews ──
export const apiGetReviews = (listingId: string) => call("getReviews", { listingId });
export const apiAddReview = (params: Record<string, unknown>) => call("addReview", params);
export const apiGetPendingReviews = () => call("getPendingReviews");
export const apiModerateReview = (id: string, approved: boolean) => call("moderateReview", { id, approved });

export const apiGetEmailNotificationPref = (userId: string) => call("getEmailNotificationPref", { userId });
export const apiSetEmailNotificationPref = (userId: string, enabled: boolean) => call("setEmailNotificationPref", { userId, enabled });

export const apiGetTgNotificationPref = (userId: string) => call("getTgNotificationPref", { userId });
export const apiSetTgNotificationPref = (userId: string, enabled: boolean) => call("setTgNotificationPref", { userId, enabled });

export const apiTestTgNotification = () => call("testTgNotification");

export const apiGetListingStats = (listingId: string, days?: number) => call("getListingStats", { listingId, days: days || 7 });
export const apiGetHostStats = (hostId: string, days?: number) => call("getHostStats", { hostId, days: days || 7 });
export const apiGetHostListingStats = (hostId: string, listingId: string, days?: number) => call("getHostListingStats", { hostId, listingId, days: days || 7 });

export const apiGetAllPromotions = () => call("getAllPromotions");
export const apiGetPromoPricing = () => call("getPromoPricing");
export const apiUpdatePromoPricing = (promoType: string, prices: Record<string,unknown>) => call("updatePromoPricing", { promoType, prices });
export const apiUpdatePromotionStatus = (id: string, status: string) => call("updatePromotionStatus", { id, status });
export const apiCreatePromotion = (params: Record<string,unknown>) => call("createPromotion", params);
export const apiGetPromoStats = () => call("getPromoStats");
export const apiExpirePromotions = () => call("expirePromotions");
export const apiGetMyPromotions = (hostId: string) => call("getMyPromotions", { hostId });
export const apiIncrementPromoClick = (listingId: string) => call("incrementPromoClick", { listingId });
