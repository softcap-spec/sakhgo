import pool from "./pg";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendAdminEmailNotification } from "./email";
import { sendTgNotification } from "./notify";

/** Strip sensitive fields before a user row is ever sent to the client. */
export function sanitizeUser<T extends Record<string, any> | null | undefined>(user: T): Omit<T, "password_hash" | "verification_code"> | null {
  if (!user) return null;
  const { password_hash, verification_code, ...safe } = user;
  return safe;
}

// ── VK ID ──

export async function dbFindProfileByVkId(vkId: string) {
  const { rows: [r] } = await pool.query(
    "SELECT * FROM profiles WHERE vk_id = $1", [vkId]
  );
  return r || null;
}

export async function dbLinkVkId(userId: string, vkId: string) {
  await pool.query(
    "UPDATE profiles SET vk_id = $1 WHERE id = $2", [vkId, userId]
  );
}

export async function dbCreateProfileFromVk(user: {
  vkId: string; name: string; email: string; phone?: string; phoneVerified?: boolean;
}) {
  const { rows: [r] } = await pool.query(
    `INSERT INTO profiles (name, email, phone, phone_verified, vk_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET vk_id = $5
     RETURNING *`,
    [user.name, user.email, user.phone || "", user.phoneVerified || false, user.vkId]
  );
  return r;
}

// ── Profiles ──

export async function dbGetProfile(email: string) {
  const { rows } = await pool.query("SELECT * FROM profiles WHERE email = $1", [email]);
  return rows[0] ?? null;
}

/** Login: verify password against bcrypt hash. Password is required. */
export async function dbLogin(email: string, password: string) {
  const user = await dbGetProfile(email);
  if (!user) return null;
  if (!user.password_hash) return null; // no password set = cannot log in
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return user;
}

/** Generate a password reset token. Returns { name, email, token } or null. */
export async function dbCreatePasswordResetToken(email: string) {
  const user = await dbGetProfile(email);
  if (!user || !user.password_hash) return null;
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour
  await pool.query(
    "UPDATE profiles SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3",
    [token, expires.toISOString(), email]
  );
  return { name: user.name, email: user.email, token };
}

/** Verify reset token and set new password. Returns { id, email } or null. */
export async function dbResetPassword(token: string, newPassword: string) {
  const { rows } = await pool.query(
    "SELECT id, email FROM profiles WHERE password_reset_token = $1 AND password_reset_expires > NOW()",
    [token]
  );
  if (rows.length === 0) return null;
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE profiles SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2",
    [hash, rows[0].id]
  );
  return rows[0];
}

// ── Email Verification ──

export async function dbCreateEmailVerificationCode(email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const { rows: [r] } = await pool.query(
    `UPDATE profiles SET email_verification_code = $1, email_verification_expires = $2
     WHERE email = $3 AND email_verified = false
     RETURNING id, email, name`,
    [token, expires.toISOString(), email]
  );
  return r ? { id: r.id, email: r.email, name: r.name, token, expires } : null;
}

export async function dbVerifyEmail(token: string) {
  const { rows: [r] } = await pool.query(
    `UPDATE profiles SET email_verified = true, email_verification_code = NULL, email_verification_expires = NULL
     WHERE email_verification_code = $1 AND email_verification_expires > NOW()
     RETURNING id, email, name, email_verified`,
    [token]
  );
  return r || null;
}

export async function dbCreateProfile(profile: {
  name: string; email: string; phone: string; password?: string;
}) {
  const passwordHash = profile.password ? await bcrypt.hash(profile.password, 12) : null;
  // Generate 6-digit verification code
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  const { rows } = await pool.query(
    `INSERT INTO profiles (name, email, phone, password_hash, role, verification_code)
     VALUES ($1, $2, $3, $4, 'user', $5)
     RETURNING *`,
    [profile.name, profile.email, profile.phone, passwordHash, verificationCode]
  );
  // Notify admin
  dbAddAdminNotification("new_user", `Новый пользователь: ${profile.name} (${profile.email})`).catch(() => {});
  return rows[0];
}

/** Change password: verify current password, then set new */
export async function dbChangePassword(id: string, currentPassword: string, newPassword: string) {
  const { rows } = await pool.query("SELECT password_hash FROM profiles WHERE id = $1", [id]);
  if (!rows[0]) return { ok: false, error: "Пользователь не найден" };
  if (rows[0].password_hash) {
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return { ok: false, error: "Неверный текущий пароль" };
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE profiles SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, id]);
  return { ok: true };
}

// ── Phone Verification ──

/** Verify phone with code that was generated during registration or later */
export async function dbVerifyPhone(email: string, code: string) {
  const { rows } = await pool.query(
    "SELECT id, verification_code, verification_attempts, updated_at FROM profiles WHERE email = $1",
    [email]
  );
  if (!rows[0]) return { ok: false, error: "Пользователь не найден" };
  if (!rows[0].verification_code) return { ok: false, error: "Код не был сгенерирован. Запросите новый код." };

  // Rate limit: max 5 attempts
  const attempts = rows[0].verification_attempts || 0;
  if (attempts >= 5) return { ok: false, error: "Слишком много попыток. Запросите новый код." };

  // Code expires after 10 minutes
  const ageMinutes = (Date.now() - new Date(rows[0].updated_at).getTime()) / 60000;
  if (ageMinutes > 10) return { ok: false, error: "Код истёк. Запросите новый код." };

  if (rows[0].verification_code !== code) {
    await pool.query(
      "UPDATE profiles SET verification_attempts = COALESCE(verification_attempts, 0) + 1 WHERE email = $1",
      [email]
    );
    return { ok: false, error: "Неверный код подтверждения" };
  }

  await pool.query(
    "UPDATE profiles SET phone_verified = true, verification_code = NULL, verification_attempts = 0, updated_at = now() WHERE email = $1",
    [email]
  );
  return { ok: true };
}

/** Generate and store a new verification code, return it for display */
export async function dbGenerateVerificationCode(email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { rows } = await pool.query(
    "UPDATE profiles SET verification_code = $1, updated_at = now(), verification_attempts = 0 WHERE email = $2 RETURNING id",
    [code, email]
  );
  if (!rows[0]) return { ok: false, error: "Пользователь не найден" };
  return { ok: true, code };
}

const SELF_EDITABLE_COLUMNS = new Set(["name", "phone", "avatar_url", "bio"]);

export async function dbUpdateProfile(id: string, data: Record<string, unknown>, isAdmin: boolean = false) {
  const allowed = isAdmin ? null : SELF_EDITABLE_COLUMNS;
  const keys = Object.keys(data).filter((k) => (!allowed || allowed.has(k)));
  if (keys.length === 0) return null;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map((k) => data[k]);
  const { rows } = await pool.query(
    `UPDATE profiles SET ${setClauses.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

export async function dbUpdateUserRole(id: string, role: string) {
  const { rows } = await pool.query(
    "UPDATE profiles SET role = $2, updated_at = now() WHERE id = $1 RETURNING *",
    [id, role]
  );
  return rows[0];
}

/** Admin: get all profiles */
export async function dbGetAllProfiles() {
  const { rows } = await pool.query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM listings WHERE host_id = p.id)::int AS listings_count,
       (SELECT COUNT(*) FROM bookings WHERE guest_id = p.id)::int AS bookings_count
     FROM profiles p
     ORDER BY p.created_at DESC`
  );
  return rows.map(sanitizeUser);
}

/** Admin: get all listings (including inactive/unverified) */
export async function dbGetAllListings() {
  const { rows } = await pool.query(
    `SELECT l.*, p.name AS host_name, p.email AS host_email,
            COALESCE(li.images, '{}'::text[]) AS images
     FROM listings l
     LEFT JOIN profiles p ON l.host_id = p.id
     LEFT JOIN LATERAL (
       SELECT array_agg(li.storage_path ORDER BY li.sort_order) AS images
       FROM listing_images li
       WHERE li.listing_id = l.id
     ) li ON true
     ORDER BY l.created_at DESC`
  );
  return rows;
}


export async function dbDeletePromotion(id: string) {
  // Only delete non-active promotions (expired/cancelled/refunded/draft)
  const { rowCount } = await pool.query(
    "DELETE FROM promotions WHERE id = $1 AND status != 'active' AND status != 'pending'",
    [id]
  );
  return { ok: true, deleted: (rowCount ?? 0) > 0 };
}

export async function dbApplyListingPromo(
  hostId: string, listingId: string,
  promoType: "top" | "urgent" | "highlight", durationDays: number = 7
) {
  const { rows } = await pool.query(
    "SELECT id, title FROM listings WHERE id = $1 AND host_id = $2",
    [listingId, hostId]
  );
  if (!rows[0]) return { ok: false as const, error: "Listing not found" };

  const safeDays = Math.min(durationDays, 30);
  await pool.query(
    `UPDATE listings SET promo = $2, promo_expires_at = now() + ($3 || ' days')::interval, updated_at = now()
     WHERE id = $1`,
    [listingId, promoType, safeDays]
  );
  return { ok: true as const };
}

/** Admin: update any listing directly */
const ADMIN_LISTING_EDITABLE_COLUMNS = new Set([
  "title", "description", "price", "location", "amenities", "images",
  "phone", "email", "website", "max_guests", "min_days",
  "latitude", "longitude", "photos", "amenities_list",
  "verified", "active", "promo", "promo_expires_at", "promo_type", "host_id"
]);

export async function dbAdminUpdateListing(id: string, data: Record<string, unknown>) {
  const keys = Object.keys(data).filter(k => ADMIN_LISTING_EDITABLE_COLUMNS.has(k));
  if (keys.length === 0) return null;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map((k) => data[k]);
  const { rows } = await pool.query(
    `UPDATE listings SET ${setClauses.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

// ── Listings (CRUD matching actual schema with listing_type enum) ──

/** Public: get active + verified listings for catalog */
export async function dbGetPublicListings(filters?: {
  type?: string;
  location?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  let conditions = "WHERE active = true AND verified = true";
  const params: unknown[] = [];
  let i = 1;
  let hasSearch = false;

  if (filters?.type) {
    conditions += ` AND type = $${i++}`;
    params.push(filters.type);
  }
  if (filters?.location) {
    conditions += ` AND location = $${i++}`;
    params.push(filters.location);
  }
  if (filters?.search) {
    hasSearch = true;
    conditions += ` AND search_vector @@ plainto_tsquery('russian', $${i++})`;
    params.push(filters.search);
  }
  if (filters?.minPrice != null) {
    conditions += ` AND price >= $${i++}`;
    params.push(filters.minPrice);
  }
  if (filters?.maxPrice != null) {
    conditions += ` AND price <= $${i++}`;
    params.push(filters.maxPrice);
  }

  const rankCol = hasSearch ? `, ts_rank(search_vector, plainto_tsquery('russian', $${i})) as rank` : "";

  let order = "ORDER BY rating DESC NULLS LAST, views DESC";
  if (hasSearch) order = "ORDER BY rank DESC, rating DESC NULLS LAST";
  else if (filters?.sort === "price_asc") order = "ORDER BY price ASC";
  else if (filters?.sort === "rating") order = "ORDER BY rating DESC NULLS LAST, views DESC";
  // "top" = promoted first
  else if (filters?.sort === "top") order = "ORDER BY promo IS NOT NULL DESC, rating DESC NULLS LAST, views DESC";

  const query = `SELECT id, host_id AS "hostId", title, slug, type, location, price,
            price_unit AS "priceUnit", rating, reviews_count AS "reviewsCount",
            views, bookings_count AS "bookingsCount", active, verified,
            promo, cover_image AS "coverImage", description,
            max_guests AS "maxGuests", rooms_count AS "roomsCount",
            beds_count AS "bedsCount", amenities,
            requires_border_permit AS "requiresBorderPermit",
            season, transport_type AS "transportType",
            tour_duration_hours AS "tourDurationHours",
            tour_duration_days AS "tourDurationDays",
            difficulty_level AS "difficultyLevel", includes,
            fishing_type AS "fishingType", fish_species AS "fishSpecies",
            fishing_method AS "fishingMethod", gear_included AS "gearIncluded",
            catch_guarantee AS "catchGuarantee", license_required AS "licenseRequired",
            boat_included AS "boatIncluded", meals_included AS "mealsIncluded",
            gear_condition AS "gearCondition",
            created_at AS "createdAt", updated_at AS "updatedAt"${rankCol},
            COALESCE(li.images, '{}'::text[]) AS images
     FROM listings
     LEFT JOIN LATERAL (
       SELECT array_agg(li.storage_path ORDER BY li.sort_order) AS images
       FROM listing_images li
       WHERE li.listing_id = listings.id
     ) li ON true
     ${conditions} ${order}
     LIMIT $${i++} OFFSET $${i}`;

  const { rows } = await pool.query(
    query,
    [...params, filters?.limit ?? 50, filters?.offset ?? 0]
  );
  return rows;
}

/** Public: get total count for pagination */
export async function dbGetPublicListingsCount(filters?: {
  type?: string;
  location?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  let conditions = "WHERE active = true AND verified = true";
  const params: unknown[] = [];
  let i = 1;

  if (filters?.type) {
    conditions += ` AND type = $${i++}`;
    params.push(filters.type);
  }
  if (filters?.location) {
    conditions += ` AND location = $${i++}`;
    params.push(filters.location);
  }
  if (filters?.search) {
    conditions += ` AND search_vector @@ plainto_tsquery('russian', $${i++})`;
    params.push(filters.search);
  }
  if (filters?.minPrice != null) {
    conditions += ` AND price >= $${i++}`;
    params.push(filters.minPrice);
  }
  if (filters?.maxPrice != null) {
    conditions += ` AND price <= $${i++}`;
    params.push(filters.maxPrice);
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM listings ${conditions}`,
    params
  );
  return rows[0]?.total ?? 0;
}

/** Public: get single listing by slug or id */
/** Public: get single listing by slug or id (only active + verified) */
export async function dbGetListingById(id: string) {
  return await _dbGetListingByIdCore(id, true);
}

/** Admin: get any listing by id (including pending/unverified) */
export async function dbGetListingByIdAdmin(id: string) {
  return await _dbGetListingByIdCore(id, false);
}

async function _dbGetListingByIdCore(id: string, publicOnly: boolean) {
  const filter = publicOnly ? "AND l.active = true AND l.verified = true" : "";
  const { rows } = await pool.query(
    `SELECT l.id, l.host_id AS "hostId", l.title, l.slug, l.type, l.location, l.price,
            l.price_unit AS "priceUnit", l.rating, l.reviews_count AS "reviewsCount",
            l.views, l.bookings_count AS "bookingsCount", l.active, l.verified,
            l.promo, l.cover_image AS "coverImage", l.description,
            l.max_guests AS "maxGuests", l.rooms_count AS "roomsCount",
            l.beds_count AS "bedsCount", l.amenities,
            l.requires_border_permit AS "requiresBorderPermit",
            l.season, l.transport_type AS "transportType",
            l.tour_duration_hours AS "tourDurationHours",
            l.tour_duration_days AS "tourDurationDays",
            l.difficulty_level AS "difficultyLevel", l.includes,
            l.fishing_type AS "fishingType", l.fish_species AS "fishSpecies",
            l.fishing_method AS "fishingMethod", l.gear_included AS "gearIncluded",
            l.catch_guarantee AS "catchGuarantee", l.license_required AS "licenseRequired",
            l.boat_included AS "boatIncluded", l.meals_included AS "mealsIncluded",
            l.gear_condition AS "gearCondition",
            l.created_at AS "createdAt", l.updated_at AS "updatedAt",
            COALESCE(li.images, '{}'::text[]) AS images,
            p.name AS "hostName", p.avatar_url AS "hostAvatar", p.phone AS "hostPhone"
     FROM listings l
     LEFT JOIN profiles p ON l.host_id = p.id
     LEFT JOIN LATERAL (
       SELECT array_agg(li.storage_path ORDER BY li.sort_order) AS images
       FROM listing_images li
       WHERE li.listing_id = l.id
     ) li ON true
     WHERE l.id = $1 ${filter}`,
    [id]
  );
  return rows[0] ?? null;
}

/** Host: get own listing by id (no active/verified filter) */
export async function dbGetHostListingById(id: string, hostId: string) {
  const { rows } = await pool.query(
    `SELECT l.*, COALESCE(li.images, '{}'::text[]) AS images
     FROM listings l
     LEFT JOIN LATERAL (
       SELECT array_agg(li.storage_path ORDER BY li.sort_order) AS images
       FROM listing_images li
       WHERE li.listing_id = l.id
     ) li ON true
     WHERE l.id = $1 AND l.host_id = $2`,
    [id, hostId]
  );
  return rows[0] ?? null;
}

/** Host: get own listings */
export async function dbGetMyListings(hostId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId)) {
    return [];
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.host_id AS "hostId", l.title, l.type, l.location, l.price,
            l.price_unit AS "priceUnit", l.rating, l.views, l.bookings_count AS "bookingsCount",
            l.active, l.verified, l.promo, l.cover_image AS "coverImage",
            COALESCE(li.images, '{}'::text[]) AS images,
            l.created_at AS "createdAt", l.updated_at AS "updatedAt"
     FROM listings l
     LEFT JOIN LATERAL (
       SELECT array_agg(li.storage_path ORDER BY li.sort_order) AS images
       FROM listing_images li
       WHERE li.listing_id = l.id
     ) li ON true
     WHERE l.host_id = $1
     ORDER BY l.created_at DESC`,
    [hostId]
  );
  return rows;
}

/** Host: create listing (active=false, goes to moderation) */
export async function dbAddListing(data: {
  hostId: string;
  title: string;
  type: string;       // listing_type enum value: property|tour|fishing|rental_gear
  location: string;
  price: number;      // integer price in RUB
  description?: string;
  maxGuests?: number;
  roomsCount?: number;
  bedsCount?: number;
  amenities?: string[];
  coverImage?: string;
  season?: string;
  cancellationPolicy?: string;
  // tour-specific
  tourDurationHours?: number;
  tourDurationDays?: number;
  difficultyLevel?: string;
  includes?: string[];
  requiresBorderPermit?: boolean;
  transportIncluded?: boolean;
  // fishing-specific
  fishingType?: string;
  fishSpecies?: string[];
  fishingMethod?: string;
  gearIncluded?: boolean;
  catchGuarantee?: string;
  licenseRequired?: boolean;
  boatIncluded?: boolean;
  mealsIncluded?: boolean;
  // rental_gear-specific
  transportType?: string;
  gearCondition?: string;
}) {
  const slug = data.title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    + '-' + Math.random().toString(36).slice(2, 8);

  const { rows } = await pool.query(
    `INSERT INTO listings (
       host_id, title, slug, type, location, price,
       description, max_guests, rooms_count, beds_count,
       amenities, cover_image, season,
       requires_border_permit,
       tour_duration_hours, tour_duration_days, difficulty_level,
       includes,
       fishing_type, fish_species, fishing_method,
       gear_included, catch_guarantee, license_required,
       boat_included, meals_included,
       transport_type, gear_condition,
       active, verified
     ) VALUES (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,
       $11,$12,$13,
       $14,
       $15,$16,$17,
       $18,
       $19,$20,$21,
       $22,$23,$24,
       $25,$26,
       $27,$28,
       false, false
     ) RETURNING id`,
    [
      data.hostId, data.title, slug, data.type, data.location, data.price,
      data.description ?? null, data.maxGuests ?? null, data.roomsCount ?? null, data.bedsCount ?? null,
      data.amenities ?? null, data.coverImage ?? null, data.season ?? null,
      data.requiresBorderPermit ?? false,
      data.tourDurationHours ?? null, data.tourDurationDays ?? null, data.difficultyLevel ?? null,
      data.includes ?? null,
      data.fishingType ?? null, data.fishSpecies ?? null, data.fishingMethod ?? null,
      data.gearIncluded ?? false, data.catchGuarantee ?? null, data.licenseRequired ?? false,
      data.boatIncluded ?? false, data.mealsIncluded ?? false,
      data.transportType ?? null, data.gearCondition ?? null
    ]
  );
  return rows[0];
}

/** Host: update listing (sets verified=false, triggers re-moderation) */
const LISTING_SELF_EDITABLE_COLUMNS = new Set([
  "title", "description", "price", "location", "amenities", "images",
  "phone", "email", "website", "max_guests", "min_days",
  "latitude", "longitude", "photos", "amenities_list"
]);

export async function dbUpdateListing(id: string, hostId: string, patch: Record<string, unknown>) {
  const rawKeys = Object.keys(patch);
  const keys = rawKeys.filter(k => LISTING_SELF_EDITABLE_COLUMNS.has(k));
  if (keys.length === 0) return;
  // Only reset verified if content changed
  const setClauses = [...keys.map((k, i) => `${k} = $${i + 3}`)];
  // Reset verified if content changed
  setClauses.push("verified = false");
  const values = keys.map((k) => patch[k]);
  await pool.query(
    `UPDATE listings SET ${setClauses.join(", ")}, updated_at = now()
     WHERE id = $1 AND host_id = $2`,
    [id, hostId, ...values]
  );
}

/** Admin: approve listing (set verified=true, active=true) */
export async function dbApproveListing(id: string) {
  await pool.query(
    `UPDATE listings SET verified = true, active = true, updated_at = now() WHERE id = $1`,
    [id]
  );
}

/** Host: delete own listing */
export async function dbRemoveListing(id: string, hostId: string) {
  await pool.query("DELETE FROM listings WHERE id = $1 AND host_id = $2", [id, hostId]);
}

// ── Listing Images ──

export async function dbAddListingImage(listingId: string, storagePath: string, sortOrder: number) {
  await pool.query(
    `INSERT INTO listing_images (listing_id, storage_path, sort_order) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [listingId, storagePath, sortOrder]
  );
}

export async function dbRemoveListingImage(listingId: string, storagePath: string) {
  await pool.query(
    "DELETE FROM listing_images WHERE listing_id = $1 AND storage_path = $2",
    [listingId, storagePath]
  );
}

export async function dbGetListingImages(listingId: string) {
  const { rows } = await pool.query(
    "SELECT storage_path FROM listing_images WHERE listing_id = $1 ORDER BY sort_order",
    [listingId]
  );
  return rows.map((r: any) => r.storage_path);
}

// ── Reviews ──

export async function dbGetReviews(listingId: string) {
  const { rows } = await pool.query(
    `SELECT id, listing_id AS "listingId", booking_id AS "bookingId",
            guest_id AS "guestId", guest_name AS "guestName", guest_avatar AS "guestAvatar",
            rating, text, moderated, created_at AS "createdAt"
     FROM reviews WHERE listing_id = $1 AND moderated = true
     ORDER BY created_at DESC`,
    [listingId]
  );
  return rows;
}

export async function dbAddReview(data: {
  listingId: string; bookingId?: string; guestId: string;
  guestName: string; guestAvatar?: string; rating: number; text: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO reviews (listing_id, booking_id, guest_id, guest_name, guest_avatar, rating, text, moderated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING *`,
    [data.listingId, data.bookingId || null, data.guestId, data.guestName, data.guestAvatar || null, data.rating, data.text]
  );
  // Notify admin
  dbAddAdminNotification("new_review", `Новый отзыв на модерации от ${data.guestName}`,
    `/admin?tab=moderation`).catch(() => {});
  return rows[0];
}

export async function dbGetPendingReviews() {
  const { rows } = await pool.query(
    `SELECT r.*, p.name AS "guestName", p.avatar_url AS "guestAvatar"
     FROM reviews r LEFT JOIN profiles p ON r.guest_id = p.id
     WHERE r.moderated = false ORDER BY r.created_at DESC`
  );
  return rows;
}

export async function dbModerateReview(id: string, approved: boolean) {
  if (approved) {
    await pool.query("UPDATE reviews SET moderated = true WHERE id = $1", [id]);
  } else {
    await pool.query("DELETE FROM reviews WHERE id = $1", [id]);
  }
}

// ── Bookings ──

export async function dbGetMyBookings(guestId: string) {
  // Validate UUID format to avoid SQL errors from non-UUID store IDs
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guestId)) {
    return [];
  }
  const { rows } = await pool.query(
    `SELECT id, listing_id AS "listingId", listing_title AS "listingTitle",
            listing_type AS "listingType", location, guest_id AS "guestId",
            guest_name AS "guestName", host_name AS "hostName",
            check_in::text AS "checkIn", check_out::text AS "checkOut",
            guests, total_price AS "totalPrice", status,
            created_at::text AS "createdAt"
     FROM bookings WHERE guest_id = $1 ORDER BY created_at DESC`,
    [guestId]
  );
  return rows;
}

export async function dbAddBooking(data: {
  listingId: string; listingTitle: string; listingType: string; location: string;
  guestId: string; guestName: string; hostName: string; hostId: string;
  checkIn: string; checkOut: string; guests: number; totalPrice: number;
  guestMessage?: string;
}) {
  // Fetch listing to verify price and check date overlap
  const { rows: [listing] } = await pool.query(
    "SELECT price, type, host_id FROM listings WHERE id = $1 AND active = true",
    [data.listingId]
  );
  if (!listing) throw new Error("Listing not found or inactive");
  
  // Recalculate total price (ignoring client-supplied price)
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const totalPrice = listing.type === "rental_gear" ? listing.price : listing.price * nights;
  
  // Check for overlapping bookings
  const { rows: overlaps } = await pool.query(
    `SELECT id FROM bookings WHERE listing_id = $1 AND status != 'cancelled'
     AND check_in < $2 AND check_out > $3`,
    [data.listingId, data.checkOut, data.checkIn]
  );
  if (overlaps.length > 0) {
    throw new Error("Dates are already booked");
  }
  
  const { rows } = await pool.query(
    `INSERT INTO bookings (listing_id, listing_title, listing_type, location,
            guest_id, guest_name, host_id, host_name, check_in, check_out,
            guests, total_price, guest_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [data.listingId, data.listingTitle, data.listingType, data.location,
     data.guestId, data.guestName, data.hostId, data.hostName,
     data.checkIn, data.checkOut, data.guests, totalPrice, data.guestMessage ?? null]
  );
  dbAddAdminNotification("new_booking", `Новая бронь: ${data.listingTitle} → ${data.guestName}`,
    `/dashboard`).catch(() => {});
  return rows[0];
}

export async function dbUpdateBookingStatus(id: string, status: string) {
  await pool.query("UPDATE bookings SET status = $2 WHERE id = $1", [id, status]);
}

// ── Banners ──

export async function dbGetBanners() {
  const { rows } = await pool.query(
    `SELECT id, title, image_url AS "imageUrl", link_url AS "linkUrl",
            html_content AS "htmlContent", slot,
            active, impressions, clicks, start_date::text AS "startDate",
            end_date::text AS "endDate"
     FROM banners ORDER BY created_at DESC`
  );
  return rows;
}

export async function dbAddBanner(data: {
  title: string; imageUrl: string; linkUrl: string; htmlContent?: string; slot: string;
  active?: boolean; startDate?: string | null; endDate?: string | null;
}) {
  const { rows } = await pool.query(
    `INSERT INTO banners (title, image_url, link_url, html_content, slot, active, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      data.title, data.imageUrl || "", data.linkUrl, data.htmlContent ?? null, data.slot, data.active ?? true,
      data.startDate || null, data.endDate || null
    ]
  );
  return rows[0];
}

const BANNER_VALID_COLUMNS = new Set([
  "title", "image_url", "link_url", "html_content", "slot",
  "active", "start_date", "end_date",
]);

export async function dbUpdateBanner(id: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch).filter(k => patch[k] !== undefined && BANNER_VALID_COLUMNS.has(k));
  if (keys.length === 0) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map((k) => patch[k]);
  await pool.query(`UPDATE banners SET ${setClauses.join(", ")} WHERE id = $1`, [id, ...values]);
}

export async function dbRemoveBanner(id: string) {
  await pool.query("DELETE FROM banners WHERE id = $1", [id]);
}

// ── Pending Edits ──

export async function dbGetPendingEdits() {
  const { rows } = await pool.query(
    `SELECT id, listing_id AS "listingId", listing_title AS "listingTitle",
            host_id AS "hostId", host_name AS "hostName", changes,
            submitted_at::text AS "submittedAt", status
     FROM pending_edits WHERE status = 'pending' ORDER BY submitted_at DESC`
  );
  return rows;
}

export async function dbAddPendingEdit(data: {
  listingId: string; listingTitle: string; hostId: string; hostName: string;
  changes: Record<string, unknown>;
}) {
  const { rows } = await pool.query(
    `INSERT INTO pending_edits (listing_id, listing_title, host_id, host_name, changes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.listingId, data.listingTitle, data.hostId, data.hostName, JSON.stringify(data.changes)]
  );
  // Notify admin
  dbAddAdminNotification("new_edit", `Объявление на модерации: ${data.listingTitle}`,
    `/listings/${data.listingId}`).catch(() => {});
  return rows[0];
}

export async function dbApproveEdit(editId: string, listingId: string, changes: Record<string, string>) {
  // Verify listing exists before proceeding
  const { rows: listingRows } = await pool.query("SELECT id FROM listings WHERE id = $1", [listingId]);
  if (!listingRows[0]) {
    console.error(`[dbApproveEdit] Listing ${listingId} not found`);
    await pool.query("UPDATE pending_edits SET status = 'rejected' WHERE id = $1", [editId]);
    return;
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  // Valid listing column names (snake_case from schema)
  const VALID_COLUMNS = new Set([
    "title", "type", "location", "price",
    "description", "max_guests", "rooms_count", "beds_count",
    "amenities", "cover_image", "season",
    "requires_border_permit",
    "tour_duration_hours", "tour_duration_days", "difficulty_level",
    "includes",
    "fishing_type", "fish_species", "fishing_method",
    "gear_included", "catch_guarantee", "license_required",
    "boat_included", "meals_included",
    "transport_type", "gear_condition",
  ]);

  // camelCase → snake_case mapping
  const KEY_MAP: Record<string, string> = {
    bedsCount: "beds_count", maxGuests: "max_guests", roomsCount: "rooms_count",
    coverImage: "cover_image", tourDurationDays: "tour_duration_days",
    tourDurationHours: "tour_duration_hours", difficultyLevel: "difficulty_level",
    fishingType: "fishing_type", fishSpecies: "fish_species",
    fishingMethod: "fishing_method", gearIncluded: "gear_included",
    catchGuarantee: "catch_guarantee", licenseRequired: "license_required",
    boatIncluded: "boat_included", mealsIncluded: "meals_included",
    transportType: "transport_type", gearCondition: "gear_condition",
    requiresBorderPermit: "requires_border_permit",
    dependsOnWeather: "depends_on_weather", transportIncluded: "transport_included",
    cancellationPolicy: "cancellation_policy", startPoint: "start_point",
    groupSizeMin: "group_size_min", groupSizeMax: "group_size_max",
  };

  // Separate images from listing columns
  let images: string[] | null = null;
  for (const [k, v] of Object.entries(changes)) {
    if (k === "images") {
      if (Array.isArray(v)) {
        images = v as any;
      } else if (typeof v === "string") {
        try { images = JSON.parse(v); } catch { images = [v]; }
      }
      continue;
    }
    if (k === "status") continue; // skip meta field
    const col = KEY_MAP[k] || k;
    if (!VALID_COLUMNS.has(col)) continue; // skip unknown columns
    // Handle JSON-array fields
    let value: unknown = v;
    if (col === "amenities" || col === "includes" || col === "fish_species") {
      if (typeof v === "string" && (v.startsWith("[") || v.startsWith('{"'))) {
        try { value = JSON.parse(v); } catch { value = v; }
      }
    }
    setClauses.push(`${col} = $${i}`);
    values.push(value);
    i++;
  }

  if (setClauses.length > 0) {
    setClauses.push("verified = true");
    values.push(listingId);
    await pool.query(`UPDATE listings SET ${setClauses.join(", ")} WHERE id = $${i}`, values);
  }

  // Sync images into listing_images table
  if (images !== null) {
    await pool.query("DELETE FROM listing_images WHERE listing_id = $1", [listingId]);
    for (let j = 0; j < images.length; j++) {
      await pool.query(
        "INSERT INTO listing_images (listing_id, storage_path, sort_order) VALUES ($1, $2, $3)",
        [listingId, images[j], j]
      );
    }
  }

  await pool.query("UPDATE pending_edits SET status = 'approved' WHERE id = $1", [editId]);
}

export async function dbRejectEdit(editId: string) {
  await pool.query("UPDATE pending_edits SET status = 'rejected' WHERE id = $1", [editId]);
}

// ── Help ──

export async function dbGetHelpContent() {
  const { rows } = await pool.query("SELECT key, content FROM help_content");
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.content;
  return map;
}

export async function dbSetHelpContent(key: string, content: string) {
  await pool.query(
    `INSERT INTO help_content (key, content, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET content = $2, updated_at = now()`,
    [key, content]
  );
}

// ── Cross-sell suggestions ──
export async function dbGetCrossSell(listingId: string) {
  // same location first, then fallback to other locations
  const qs = `SELECT l.id, l.title, l.type, l.location, l.price,
      l.price_unit AS price_unit,
      COALESCE(
        (SELECT li.storage_path FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.sort_order LIMIT 1),
        l.cover_image
      ) AS image
    FROM listings l
    WHERE l.active = true AND l.verified = true
      AND l.id != $1
      AND l.type != (SELECT type FROM listings WHERE id = $1 LIMIT 1)
      AND l.location = (SELECT location FROM listings WHERE id = $1 LIMIT 1)
    ORDER BY random() LIMIT 3`;

  let { rows } = await pool.query(qs, [listingId]);

  if (rows.length === 0) {
    const qf = `SELECT l.id, l.title, l.type, l.location, l.price,
        l.price_unit AS price_unit,
        COALESCE(
          (SELECT li.storage_path FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.sort_order LIMIT 1),
          l.cover_image
        ) AS image
      FROM listings l
      WHERE l.active = true AND l.verified = true
        AND l.id != $1
        AND l.type != (SELECT type FROM listings WHERE id = $1 LIMIT 1)
      ORDER BY random() LIMIT 3`;
    const r2 = await pool.query(qf, [listingId]);
    rows = r2.rows;
  }

  const PRIORITY: Record<string, number> = { car_rental: 1, property: 2, tour: 3, fishing: 4, rental_gear: 5 };
  return rows.sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99)).slice(0, 3);
}

// ── Messages (Chat) ──

export async function dbSendMessage(listingId: string, senderId: string, senderName: string, receiverId: string, text: string) {
  const { rows } = await pool.query(
    `INSERT INTO messages (listing_id, sender_id, receiver_id, text) VALUES ($1,$2,$3,$4) RETURNING *`,
    [listingId, senderId, receiverId, text]
  );
  return rows[0] ?? null;
}

export async function dbGetMessages(listingId: string, userId: string, otherId: string) {
  const { rows } = await pool.query(
    `SELECT m.*, p.name AS sender_name, p.avatar_url AS sender_avatar
     FROM messages m
     LEFT JOIN profiles p ON m.sender_id = p.id
     WHERE m.listing_id = $1 AND ((m.sender_id = $2 AND m.receiver_id = $3) OR (m.sender_id = $3 AND m.receiver_id = $2))
     ORDER BY m.created_at ASC`,
    [listingId, userId, otherId]
  );
  return rows;
}

export async function dbGetChatList(userId: string) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (m.listing_id, CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
       m.listing_id, l.title AS listing_title,
       COALESCE(
         (SELECT li.storage_path FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.sort_order LIMIT 1),
         l.cover_image
       ) AS listing_image,
       CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_id,
       CASE WHEN m.sender_id = $1 THEN rp.name ELSE sp.name END AS other_name,
       CASE WHEN m.sender_id = $1 THEN rp.avatar_url ELSE sp.avatar_url END AS other_avatar,
       (SELECT msg.text FROM messages msg WHERE msg.listing_id = m.listing_id AND ((msg.sender_id = $1 AND msg.receiver_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END) OR (msg.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AND msg.receiver_id = $1)) ORDER BY msg.created_at DESC LIMIT 1) AS last_message,
       TO_CHAR(m.created_at, 'HH24:MI') AS last_time,
       (SELECT COUNT(*) FROM messages um WHERE um.listing_id = m.listing_id AND um.receiver_id = $1 AND um.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AND um.read = false)::int AS unread
     FROM messages m
     JOIN listings l ON l.id = m.listing_id
     LEFT JOIN profiles sp ON sp.id = m.sender_id
     LEFT JOIN profiles rp ON rp.id = m.receiver_id
     WHERE m.sender_id = $1 OR m.receiver_id = $1
     ORDER BY m.listing_id, (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END), m.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function dbMarkMessagesRead(listingId: string, userId: string, otherId: string) {
  await pool.query(
    `UPDATE messages SET read = true WHERE listing_id = $1 AND sender_id = $2 AND receiver_id = $3 AND read = false`,
    [listingId, otherId, userId]
  );
}

// ── Quick Pick Counts (Homepage) ──
export async function dbGetQuickPickCounts() {
  const picks = [
    { id: "mountain", label: "Жильё", types: ["property"], locations: ["Южно-Сахалинск"] },
    { id: "sea", label: "Морские выходы", types: ["tour", "fishing"], locations: ["Корсаков", "Невельск", "Холмск"] },
    { id: "jeep", label: "Джип-туры", types: ["tour"], locations: ["Корсаков", "Курильск", "Южно-Сахалинск"] },
    { id: "fishing", label: "Рыбалка", types: ["fishing"], locations: [] },
    { id: "car_rental", label: "Прокат авто", types: ["car_rental"], locations: [] },
  ];
  const result: { id: string; label: string; count: number; coverImage: string | null }[] = [];
  for (const p of picks) {
    const typePlaceholders = p.types.map((_, i) => `$${i + 1}`);
    const locConditions = p.locations.length > 0
      ? `OR l.location IN (${p.locations.map((_, i) => `$${p.types.length + i + 1}`).join(", ")})`
      : "";
    const params: (string | number)[] = [...p.types, ...p.locations];
    // Pick a random listing that actually has an image (either listing_images or cover_image),
    // preferring the primary type for the category.
    const query = `
      WITH pick_listings AS (
        SELECT l.id, l.cover_image,
          CASE WHEN l.type = $1 THEN 0 ELSE 1 END AS type_rank
        FROM listings l
        WHERE l.active = true AND l.verified = true
          AND (l.type IN (${typePlaceholders.join(", ")}) ${locConditions})
      ),
      cnt AS (SELECT COUNT(*)::int AS count FROM pick_listings),
      img AS (
        SELECT
          COALESCE(li.storage_path, pl.cover_image) AS image
        FROM pick_listings pl
        LEFT JOIN LATERAL (
          SELECT storage_path FROM listing_images
          WHERE listing_id = pl.id ORDER BY sort_order LIMIT 1
        ) li ON true
        WHERE COALESCE(li.storage_path, pl.cover_image) IS NOT NULL
        ORDER BY pl.type_rank, random() LIMIT 1
      )
      SELECT c.count, i.image FROM cnt c LEFT JOIN img i ON true
    `;
    const { rows } = await pool.query(query, params);
    result.push({ id: p.id, label: p.label, count: rows[0]?.count ?? 0, coverImage: rows[0]?.image ?? null });
  }
  return result;
}

// ── Admin Notifications ──

export async function dbGetAdminNotifications(limit = 50) {
  const { rows } = await pool.query(
    "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}

export async function dbGetUnreadNotificationCount() {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int as count FROM admin_notifications WHERE read = false"
  );
  return rows[0]?.count ?? 0;
}

export async function dbMarkNotificationRead(id: string) {
  await pool.query(
    "UPDATE admin_notifications SET read = true WHERE id = $1",
    [id]
  );
}

export async function dbMarkAllNotificationsRead() {
  await pool.query(
    "UPDATE admin_notifications SET read = true WHERE read = false"
  );
}

export async function dbAddAdminNotification(type: string, text: string, link?: string) {
  await pool.query(
    "INSERT INTO admin_notifications (type, text, link) VALUES ($1, $2, $3)",
    [type, text, link || null]
  );
  // Also send email + Telegram to admins (fire-and-forget)
  sendAdminEmailNotification(type, text, link).catch((e) => console.error("[email] Failed:", e));
  sendTgNotification(type as "new_user" | "new_booking" | "new_edit", text, link).catch(() => {});
}

// ── Email Notification Preferences ──

export async function dbGetEmailNotificationPref(userId: string) {
  const { rows } = await pool.query(
    "SELECT COALESCE(email_notifications, true) as enabled FROM profiles WHERE id = $1",
    [userId]
  );
  return rows[0]?.enabled ?? true;
}

export async function dbSetEmailNotificationPref(userId: string, enabled: boolean) {
  await pool.query("UPDATE profiles SET email_notifications = $2 WHERE id = $1", [userId, enabled]);
}

// ── Listing Stats (views/contacts/bookings per day) ──

export async function dbIncrementListingViews(listingId: string) {
  await pool.query(
    `INSERT INTO listing_stats (listing_id, date, views)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (listing_id, date) DO UPDATE SET views = listing_stats.views + 1`,
    [listingId]
  );
  // Also bump the totals on listings
  await pool.query("UPDATE listings SET views = COALESCE(views, 0) + 1 WHERE id = $1", [listingId]);
}

export async function dbGetListingStats(listingId: string, days: number = 7) {
  const { rows } = await pool.query(
    `SELECT date::text, views, contacts, bookings
     FROM listing_stats
     WHERE listing_id = $1 AND date >= CURRENT_DATE - $2::int
     ORDER BY date ASC`,
    [listingId, days]
  );
  return rows;
}

export async function dbGetHostStats(hostId: string, days: number = 7) {
  const { rows } = await pool.query(
    `SELECT SUM(ls.views)::int AS total_views,
            SUM(ls.contacts)::int AS total_contacts,
            SUM(ls.bookings)::int AS total_bookings,
            COUNT(DISTINCT l.id)::int AS active_listings
     FROM listing_stats ls
     JOIN listings l ON l.id = ls.listing_id
     WHERE l.host_id = $1 AND ls.date >= CURRENT_DATE - $2::int`,
    [hostId, days]
  );
  return rows[0] || { total_views: 0, total_contacts: 0, total_bookings: 0, active_listings: 0 };
}

export async function dbGetHostListingStats(hostId: string, listingId: string, days: number = 7) {
  // Generate full 7-day range with zeros for missing days
  const { rows } = await pool.query(
    `SELECT d.date::date::text AS date, COALESCE(ls.views, 0)::int AS views,
            COALESCE(ls.contacts, 0)::int AS contacts,
            COALESCE(ls.bookings, 0)::int AS bookings
     FROM generate_series(CURRENT_DATE - $3::int, CURRENT_DATE, '1 day'::interval) AS d(date)
     LEFT JOIN listing_stats ls ON ls.date = d.date AND ls.listing_id = $1
     LEFT JOIN listings l ON l.id = ls.listing_id AND l.host_id = $2
     ORDER BY d.date ASC`,
    [listingId, hostId, days]
  );
  return rows;
}

// ── Promotions (admin) ──

export async function dbGetAllPromotions(page = 1, pageSize = 15) {
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    pool.query(
      `SELECT p.*, l.type AS listing_type, l.location
       FROM promotions p
       LEFT JOIN listings l ON l.id = p.listing_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM promotions`),
  ]);
  return { items: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function dbGetPromoPricing() {
  const { rows } = await pool.query(
    `SELECT promo_type, base_price_7d, base_price_14d, base_price_21d, base_price_30d, enabled
     FROM promo_pricing ORDER BY promo_type`
  );
  return rows;
}

export async function dbUpdatePromoPricing(promoType: string, prices: {base_price_7d:number;base_price_14d:number;base_price_21d:number;base_price_30d:number;enabled:boolean}) {
  await pool.query(
    `UPDATE promo_pricing SET base_price_7d=$2, base_price_14d=$3, base_price_21d=$4, base_price_30d=$5, enabled=$6, updated_at=now()
     WHERE promo_type=$1`,
    [promoType, prices.base_price_7d, prices.base_price_14d, prices.base_price_21d, prices.base_price_30d, prices.enabled]
  );
}

export async function dbUpdatePromotionStatus(id: string, status: string) {
  const now = new Date().toISOString();
  if (status === 'active') {
    await pool.query("UPDATE promotions SET status=$2, started_at=$3, expires_at=$3::timestamptz + (duration_days || 7) * INTERVAL '1 day', updated_at=now() WHERE id=$1", [id, status, now]);
  } else if (status === 'refunded' || status === 'cancelled') {
    await pool.query("UPDATE promotions SET status=$2, expires_at=now(), updated_at=now() WHERE id=$1", [id, status]);
  } else {
    await pool.query("UPDATE promotions SET status=$2, updated_at=now() WHERE id=$1", [id, status]);
  }
}

export async function dbCreatePromotion(data: {
  listing_id:string; host_id:string; host_name:string; listing_title:string;
  promo_type:string; duration_days:number; price:number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO promotions (listing_id, host_id, host_name, listing_title, promo_type, duration_days, price, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
    [data.listing_id, data.host_id, data.host_name, data.listing_title, data.promo_type, data.duration_days, data.price]
  );
  return rows[0];
}

/**
 * Подготавливает запись продвижения к оплате.
 * Если для этого объявления уже есть незавершённый платёж — возвращает его.
 * Вызывается перед редиректом на ЮKassa; сам платёж создаётся в /api/payments/create.
 */
export async function dbInitPromoPayment(data: {
  listing_id: string; host_id: string; host_name: string; listing_title: string;
  promo_type: "top" | "urgent" | "highlight"; duration_days: number;
}) {
  const safeDays = Math.min(data.duration_days || 7, 30);

  // Read real price from promo_pricing — never trust client input
  const { rows: [pricing] } = await pool.query(
    `SELECT base_price_7d, base_price_14d, base_price_21d, base_price_30d
     FROM promo_pricing WHERE promo_type = $1 AND enabled = true`,
    [data.promo_type]
  );
  if (!pricing) throw new Error("Tariffs not found for " + data.promo_type);

  const price = safeDays >= 30 ? pricing.base_price_30d
    : safeDays >= 21 ? pricing.base_price_21d
    : safeDays >= 14 ? pricing.base_price_14d
    : pricing.base_price_7d;

  // Reuse existing draft — but only if created < 50 min ago (YooKassa payment_url TTL)
  const { rows: existing } = await pool.query(
    `SELECT id, payment_url FROM promotions
     WHERE listing_id = $1 AND host_id = $2 AND promo_type = $3
       AND status IN ('draft','pending')
       AND created_at > now() - INTERVAL '50 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [data.listing_id, data.host_id, data.promo_type]
  );
  if (existing[0]) return existing[0];

  const { rows } = await pool.query(
    `INSERT INTO promotions (listing_id, host_id, host_name, listing_title, promo_type, duration_days, price, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING id`,
    [data.listing_id, data.host_id, data.host_name, data.listing_title,
     data.promo_type, safeDays, price]
  );
  return rows[0];
}

export async function dbIncrementPromoStats(listingId: string, field: "impressions" | "clicks" | "contacts" | "bookings_from_promo") {
  await pool.query(
    `UPDATE promotions SET ${field} = COALESCE(${field}, 0) + 1 WHERE listing_id = $1 AND status = 'active'`,
    [listingId]
  );
}

export async function dbExpirePromotions() {
  // Find and expire promotions where status='active' and expires_at < now()
  const { rows: expired } = await pool.query(
    `UPDATE promotions
     SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()
     RETURNING id, listing_id`
  );

  if (expired.length > 0) {
    // Clear promo flag on related listings
    const listingIds = expired.map((r: any) => r.listing_id);
    await pool.query(
      `UPDATE listings SET promo = NULL, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [listingIds]
    );
  }

  return expired.map((r: any) => r.id);
}

export async function dbGetPromoStats() {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       SUM(CASE WHEN status='active' THEN 1 ELSE 0 END)::int AS active,
       SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid,
       SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending,
       SUM(CASE WHEN status IN ('refunded','cancelled') THEN 1 ELSE 0 END)::int AS cancelled,
       COALESCE(SUM(impressions),0)::int AS total_impressions,
       COALESCE(SUM(clicks),0)::int AS total_clicks,
       COALESCE(SUM(contacts),0)::int AS total_contacts,
       COALESCE(SUM(bookings_from_promo),0)::int AS total_bookings,
       COALESCE(SUM(CASE WHEN status IN ('paid','active') THEN price ELSE 0 END),0)::int AS total_revenue
     FROM promotions`
  );
  const stats = rows[0];

  // Monthly revenue breakdown (last 12 months)
  const { rows: monthly } = await pool.query(
    `SELECT
       to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
       SUM(price)::int AS revenue,
       COUNT(*)::int AS count
     FROM promotions
     WHERE status IN ('paid','active') AND paid_at IS NOT NULL
       AND paid_at >= now() - interval '12 months'
     GROUP BY date_trunc('month', paid_at)
     ORDER BY month`
  );
  stats.monthly_revenue = monthly;

  return stats;
}

/** Seller: get own promotions */
export async function dbGetMyPromotions(hostId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId)) {
    return [];
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.listing_id AS "listingId", p.listing_title AS "listingTitle",
            p.promo_type AS "promoType", p.duration_days AS "durationDays",
            p.price, p.status, p.impressions, p.clicks, p.contacts,
            p.bookings_from_promo AS "bookingsFromPromo",
            p.created_at::text AS "createdAt",
            p.started_at::text AS "startedAt",
            p.expires_at::text AS "expiresAt"
     FROM promotions p
     WHERE p.host_id = $1
     ORDER BY p.created_at DESC`,
    [hostId]
  );
  return rows;
}


export interface ProfilesPage {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function dbSearchProfiles(search: string, page: number, pageSize: number): Promise<ProfilesPage> {
  const offset = (page - 1) * pageSize;
  const like = `%${search}%`;
  
  const where = search
    ? `WHERE p.name ILIKE $1 OR p.email ILIKE $1`
    : "";
  const params: any[] = search ? [like] : [];
  const countParam = search ? [like] : [];
  
  const [{ rows: countRows }, { rows: items }] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int FROM profiles p ${where}`,
      countParam
    ),
    pool.query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM listings WHERE host_id = p.id)::int AS listings_count,
         (SELECT COUNT(*) FROM bookings WHERE guest_id = p.id)::int AS bookings_count
       FROM profiles p ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    ),
  ]);

  const total = countRows[0]?.count ?? 0;
  return {
    items: items.map(sanitizeUser),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  pendingEdits: number;
  totalBookings: number;
  newUsers7d: number;
  newListings7d: number;
  newBookings7d: number;
  promoRevenue: number;
  usersByRole: { role: string; count: number }[];
}

export async function dbGetAdminStats(): Promise<AdminStats> {
  const [
    { rows: [totals] },
    { rows: [weekStats] },
    { rows: roleRows },
  ] = await Promise.all([
    pool.query(
      `SELECT
        (SELECT COUNT(*) FROM profiles)::int AS "totalUsers",
        (SELECT COUNT(*) FROM listings)::int AS "totalListings",
        (SELECT COUNT(*) FROM listings WHERE active = true)::int AS "activeListings",
        (SELECT COUNT(*) FROM pending_edits WHERE status = 'pending')::int AS "pendingEdits",
        (SELECT COUNT(*) FROM bookings)::int AS "totalBookings",
        COALESCE((SELECT SUM(price) FROM promotions WHERE status IN ('paid','active')), 0)::int AS "promoRevenue"`
    ),
    pool.query(
      `SELECT
        (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days')::int AS "newUsers7d",
        (SELECT COUNT(*) FROM listings WHERE created_at >= NOW() - INTERVAL '7 days')::int AS "newListings7d",
        (SELECT COUNT(*) FROM bookings WHERE created_at >= NOW() - INTERVAL '7 days')::int AS "newBookings7d"`
    ),
    pool.query(
      `SELECT role, COUNT(*)::int AS count FROM profiles GROUP BY role ORDER BY count DESC`
    ),
  ]);

  return {
    totalUsers: totals?.totalUsers ?? 0,
    totalListings: totals?.totalListings ?? 0,
    activeListings: totals?.activeListings ?? 0,
    pendingEdits: totals?.pendingEdits ?? 0,
    totalBookings: totals?.totalBookings ?? 0,
    promoRevenue: totals?.promoRevenue ?? 0,
    newUsers7d: weekStats?.newUsers7d ?? 0,
    newListings7d: weekStats?.newListings7d ?? 0,
    newBookings7d: weekStats?.newBookings7d ?? 0,
    usersByRole: roleRows || [],
  };
}

// ── Builds History ──

export async function dbGetBuilds() {
  const { rows } = await pool.query(
    "SELECT id, version, date, description, hash, changes, created_at FROM builds ORDER BY date DESC, id DESC"
  );
  return rows;
}

export async function dbRecordBuild(params: {
  version: string; date: string; description: string; hash: string; changes: string[];
}) {
  const { rows } = await pool.query(
    `INSERT INTO builds (version, date, description, hash, changes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.version, params.date, params.description, params.hash, JSON.stringify(params.changes)]
  );
  return { ok: true, inserted: !!rows[0] };
}
