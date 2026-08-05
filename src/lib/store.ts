"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserRole } from "./types";
import { sendMaxNotification, sendTgNotification } from "./notify";
import * as api from "./api";

// ── Enum ↔ Label mapping ──

export const LISTING_TYPE_LABELS: Record<string, string> = {
  property: "Жильё",
  tour: "Тур",
  fishing: "Рыбалка",
  rental_gear: "Снаряжение",
  car_rental: "Прокат авто",
};

export const LISTING_TYPE_FROM_LABEL: Record<string, string> = {
  "Жильё": "property",
  "Тур": "tour",
  "Рыбалка": "fishing",
  "Снаряжение": "rental_gear",
  "Прокат авто": "car_rental",
};

export function labelFromType(type: string): string {
  return LISTING_TYPE_LABELS[type] || type;
}

export function typeFromLabel(label: string): string {
  return LISTING_TYPE_FROM_LABEL[label] || label;
}

export function formatPrice(price: number, type?: string): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

export function priceUnit(type: string): string {
  if (type === "property") return "₽ / ночь";
  if (type === "rental_gear" || type === "car_rental") return "₽ / сутки";
  return "₽ / чел.";
}

// ── Types ──

interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  role: UserRole;
  avatar?: string;
}

export interface Booking {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: string;
  location: string;
  guestId: string;
  guestName: string;
  hostName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  pricePerUnit?: number;
  unit?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rejected";
  createdAt: string;
}

/** Matches DB listings table + listing_images join */
export interface HostListing {
  id: string;
  hostId: string;
  title: string;
  type: string;          // DB enum: property|tour|fishing|rental_gear
  location: string;
  price: number;         // integer price in RUB
  priceUnit?: string;
  rating: number | null;
  views: number;
  bookingsCount: number;
  active: boolean;
  verified: boolean;
  promo: string | null;  // top|highlight|urgent
  coverImage?: string | null;
  description?: string | null;
  images?: string[];
  maxGuests?: number;
  roomsCount?: number;
  bedsCount?: number;
  amenities?: string[];
  // tour
  tourDurationHours?: number;
  tourDurationDays?: number;
  difficultyLevel?: string;
  includes?: string[];
  requiresBorderPermit?: boolean;
  transportIncluded?: boolean;
  // fishing
  fishingType?: string;
  fishSpecies?: string[];
  fishingMethod?: string;
  gearIncluded?: boolean;
  catchGuarantee?: string;
  licenseRequired?: boolean;
  boatIncluded?: boolean;
  mealsIncluded?: boolean;
  // rental_gear
  transportType?: string;
  gearCondition?: string;
  season?: string;
  createdAt?: string;
  updatedAt?: string;
  // join fields
  hostName?: string;
  hostAvatar?: string;
  hostPhone?: string;
}

export interface PendingEdit {
  id: string;
  listingId: string;
  listingTitle: string;
  hostId: string;
  hostName: string;
  submittedAt: string;
  changes: Record<string, unknown>;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  htmlContent?: string;
  slot: string;
  active: boolean;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string | null;
}

interface AppState {
  user: AuthUser | null;
  activeFilter: string;
  favorites: string[];
  bookings: Booking[];
  myListings: HostListing[];
  catalogListings: HostListing[];
  catalogTotal: number;
  catalogLoading: boolean;

  helpHowItWorks: string;
  helpFAQ: string;
  helpCancelPolicy: string;
  helpSupport: string;
  helpHostInfo: string;
  helpRules: string;
  helpPrivacy: string;
  helpTerms: string;

  banners: Banner[];
  pendingEdits: PendingEdit[];
  moderationNoteCount: number;

  authOpen: boolean;
  authMode: "login" | "register" | "forgot";

  // ── VK ──
  fetchMe: () => Promise<boolean>;

  // ── Auth ──
  forgotPassword: (email: string) => Promise<boolean>;
      login: (email: string, password: string) => Promise<AuthUser | null>;
  register: (name: string, email: string, phone: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;

  // ── Phone Verification ──
  generateVerificationCode: (email: string) => Promise<string | null>;
  verifyPhone: (email: string, code: string) => Promise<boolean>;

  setUser: (u: AuthUser | null) => void;
  mergeListing: (listing: HostListing) => void;
  updateUser: (id: string, data: Partial<AuthUser>) => Promise<void>;
  deleteUser: (id: string) => void;
  setAuthOpen: (v: boolean) => void;
  setAuthMode: (m: "login" | "register") => void;
  setActiveFilter: (f: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // ── Catalog (public, from DB) ──
  loadCatalog: (filters?: Record<string, unknown>) => Promise<void>;

  // ── Bookings ──
  addBooking: (b: Omit<Booking, "id" | "createdAt">) => Promise<Booking>;
  updateBookingStatus: (id: string, status: Booking["status"]) => Promise<void>;

  // ── Listings ──
  addListing: (l: {
    hostId: string; title: string; type: string; location: string; price: number;
    description?: string; maxGuests?: number; roomsCount?: number; bedsCount?: number;
    amenities?: string[]; coverImage?: string; season?: string;
    cancellationPolicy?: string;
    tourDurationHours?: number; tourDurationDays?: number; difficultyLevel?: string;
    includes?: string[]; requiresBorderPermit?: boolean; transportIncluded?: boolean;
    fishingType?: string; fishSpecies?: string[]; fishingMethod?: string;
    gearIncluded?: boolean; catchGuarantee?: string; licenseRequired?: boolean;
    boatIncluded?: boolean; mealsIncluded?: boolean;
    transportType?: string; gearCondition?: string;
    images?: string[];
  }) => Promise<string>;
  toggleListingActive: (id: string) => void;
  updateListingPromo: (id: string, promo: HostListing["promo"]) => void;
  updateListing: (id: string, data: Partial<Omit<HostListing, "id" | "hostId">>) => Promise<void>;
  requestListingEdit: (data: Omit<PendingEdit, "id" | "submittedAt">) => Promise<PendingEdit>;
  approveEdit: (editId: string) => Promise<void>;
  rejectEdit: (editId: string) => Promise<void>;
  removeListing: (id: string) => Promise<void>;
  clearModerationNotes: () => void;

  setHelpContent: (key: string, value: string) => Promise<void>;

  addBanner: (b: Omit<Banner, "id" | "impressions" | "clicks">) => Promise<Banner>;
  updateBanner: (id: string, data: Partial<Banner>) => Promise<void>;
  removeBanner: (id: string) => Promise<void>;

  loadFromDb: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
        user: null,
        activeFilter: "all",
        favorites: [],
        bookings: [],
        myListings: [],
        catalogListings: [],
        catalogTotal: 0,
        catalogLoading: false,

        helpHowItWorks: "",
        helpFAQ: "",
        helpCancelPolicy: "",
        helpSupport: "",
        helpHostInfo: "",
        helpRules: "",
        helpPrivacy: "",
        helpTerms: "",

        banners: [],
        pendingEdits: [],
        moderationNoteCount: 0,

        authOpen: false,
        authMode: "login",

        // ── Auth ──

        forgotPassword: async (email) => {
          try {
            await api.apiForgotPassword(email);
            return true;
          } catch (e: any) {
            console.error("forgotPassword error:", e);
            return false;
          }
        },
        login: async (email, password) => {
          try {
            const user = await api.apiLogin(email, password);
            const authUser: AuthUser = {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone || "",
              phoneVerified: user.phone_verified ?? false,
              twoFactorEnabled: false,
              role: user.role,
              avatar: user.avatar_url || user.avatar || undefined,
            };
            set({ user: authUser });
            return authUser;
          } catch (e) {
            console.warn("Login via API failed:", e);
            return null;
          }
        },

        register: async (name, email, phone, password) => {
          try {
            const user = await api.apiRegister(name, email, phone, password);
            const authUser: AuthUser = {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone || phone,
              phoneVerified: false,
              twoFactorEnabled: false,
              role: user.role,
              avatar: user.avatar_url || user.avatar || undefined,
            };
            set({ user: authUser });
            return authUser;
          } catch (e) {
            console.warn("Register via API failed:", e);
            return null;
          }
        },

        // ── Phone Verification ──
        generateVerificationCode: async (email) => {
          try {
            const code = await api.apiGenerateVerificationCode(email);
            return code as string;
          } catch { return null; }
        },

        verifyPhone: async (email, code) => {
          try {
            const ok = await api.apiVerifyPhone(email, code);
            if (ok) {
              set((s) => s.user ? { user: { ...s.user, phoneVerified: true } } : {});
            }
            return ok as boolean;
          } catch { return false; }
        },

              fetchMe: async () => {
          try {
            const { apiGetMe } = await import("@/lib/api");
            const user = await apiGetMe();
            if (user) {
              set({
                user: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone || "",
                  phoneVerified: user.phone_verified ?? false,
                  role: user.role,
                  avatar: user.avatar_url || user.avatar || undefined,
                  twoFactorEnabled: false,
                },
              });
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },

logout: () => set({ user: null, favorites: [], bookings: [], myListings: [], pendingEdits: [] }),

        setUser: (u) => set({ user: u }),

        mergeListing: (listing: HostListing) => set((s) => {
          const exists = s.myListings.findIndex(l => l.id === listing.id);
          if (exists >= 0) {
            const updated = [...s.myListings];
            updated[exists] = listing;
            return { myListings: updated };
          }
          return { myListings: [...s.myListings, listing] };
        }),

        updateUser: async (id, data) => {
          try { await api.apiUpdateProfile(id, data); } catch { /* local */ }
          set((s) => { if (s.user && s.user.id === id) return { user: { ...s.user, ...data } }; return {}; });
        },

        deleteUser: (id) => set((s) => s.user && s.user.id === id ? { user: null } : {}),
        setAuthOpen: (v) => set({ authOpen: v }),
        setAuthMode: (m) => set({ authMode: m }),
        setActiveFilter: (f) => set({ activeFilter: f }),
        toggleFavorite: (id) => set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id],
        })),
        isFavorite: (id) => get().favorites.includes(id),

        // ── Catalog ──

        loadCatalog: async (filters) => {
          set({ catalogLoading: true });
          try {
            const data = await api.apiGetPublicListings(filters);
            set({ catalogListings: data.listings, catalogTotal: data.total, catalogLoading: false });
          } catch {
            set({ catalogLoading: false });
          }
        },

        // ── Bookings ──

        addBooking: async (data) => {
          try {
            const booking = await api.apiAddBooking(data as any);
            const mapped: Booking = {
              id: booking.id,
              listingId: booking.listing_id || booking.listingId,
              listingTitle: booking.listing_title || booking.listingTitle,
              listingType: booking.listing_type || booking.listingType,
              location: booking.location,
              guestId: booking.guest_id || booking.guestId,
              guestName: booking.guest_name || booking.guestName,
              hostName: booking.host_name || booking.hostName,
              checkIn: booking.check_in || booking.checkIn,
              checkOut: booking.check_out || booking.checkOut,
              guests: booking.guests,
              totalPrice: booking.total_price || booking.totalPrice,
              status: booking.status,
              createdAt: booking.created_at || booking.createdAt,
            };
            set((s) => ({ bookings: [...s.bookings, mapped] }));
            return mapped;
          } catch {
            const local: Booking = {
              ...data,
              id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({ bookings: [...s.bookings, local] }));
            return local;
          }
        },

        updateBookingStatus: async (id, status) => {
          try { await api.apiUpdateBookingStatus(id, status); } catch { /* local */ }
          set((s) => ({ bookings: s.bookings.map((b) => b.id === id ? { ...b, status } : b) }));
        },

        // ── Listings (active=false → moderation) ──

        addListing: async (data) => {
          try {
            const row = await api.apiAddListing(data as any);
            const listing: HostListing = {
              id: row.id,
              hostId: data.hostId,
              title: data.title,
              type: data.type,
              location: data.location,
              price: data.price,
              priceUnit: priceUnit(data.type),
              rating: null,
              views: 0,
              bookingsCount: 0,
              active: false,
              verified: false,
              promo: null,
              images: data.images || [],
              description: data.description,
              maxGuests: data.maxGuests,
              roomsCount: data.roomsCount,
              bedsCount: data.bedsCount,
              amenities: data.amenities,
            };
            set((s) => ({ myListings: [...s.myListings, listing] }));
            // Submit to moderation
            get().requestListingEdit({
              listingId: row.id,
              listingTitle: data.title,
              hostId: data.hostId,
              hostName: get().user?.name || "",
              changes: { status: "pending_approval" },
            });
            return row.id;
          } catch {
            // Local fallback
            const local: HostListing = {
              id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              hostId: data.hostId,
              title: data.title,
              type: data.type,
              location: data.location,
              price: data.price,
              priceUnit: priceUnit(data.type),
              rating: null, views: 0, bookingsCount: 0,
              active: false, verified: false, promo: null,
              images: data.images || [],
            };
            set((s) => ({ myListings: [...s.myListings, local] }));
            return local.id;
          }
        },

        toggleListingActive: (id) => set((s) => ({
          myListings: s.myListings.map((l) => l.id === id ? { ...l, active: !l.active } : l),
        })),

        updateListingPromo: (id, promo) => {
          const user = get().user;
          if (promo) {
            import("@/lib/api").then(({ apiApplyListingPromo }) => {
              apiApplyListingPromo(user!.id, id, promo).catch(() => {});
            });
          } else {
            // Removing promo — still needs admin (host can't unset their own promo via self-edit whitelist)
            import("@/lib/api").then(({ apiUpdateListing }) => {
              apiUpdateListing(id, user!.id, { promo: null }).catch(() => {});
            });
          }
          set((s) => ({
            myListings: s.myListings.map((l) => l.id === id ? { ...l, promo } : l),
          }));
        },

        updateListing: async (id, data) => {
          try {
            const s = get();
            const listing = s.myListings.find((l) => l.id === id);
            if (listing) {
              await api.apiUpdateListing(id, listing.hostId, data as any, data.images);
            }
          } catch { /* local */ }
          set((s) => ({ myListings: s.myListings.map((l) => l.id === id ? { ...l, ...data } : l) }));
        },

        requestListingEdit: async (data) => {
          try {
            const row = await api.apiAddPendingEdit(data as any);
            const edit: PendingEdit = {
              id: row.id,
              listingId: row.listingId || row.listing_id,
              listingTitle: row.listingTitle || row.listing_title,
              hostId: row.hostId || row.host_id,
              hostName: row.hostName || row.host_name,
              submittedAt: row.submittedAt || row.submitted_at,
              changes: row.changes ?? {},
            };
            set((s) => ({
              pendingEdits: [...s.pendingEdits, edit],
              moderationNoteCount: s.moderationNoteCount + 1,
            }));
            sendMaxNotification(
              `🛡 СахGO · Новая заявка\n${edit.hostName} → «${edit.listingTitle}»`
            ).catch(() => {});
            return edit;
          } catch {
            const edit: PendingEdit = {
              ...data,
              id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              submittedAt: new Date().toISOString(),
            };
            set((s) => ({
              pendingEdits: [...s.pendingEdits, edit],
              moderationNoteCount: s.moderationNoteCount + 1,
            }));
            sendMaxNotification(
              `🛡 СахГО · Новая заявка\n${edit.hostName} → «${edit.listingTitle}»`
            ).catch(() => {});
            return edit;
          }
        },

        approveEdit: async (editId) => {
          const s = get();
          const edit = s.pendingEdits.find((e) => e.id === editId);
          if (!edit) return;
          try {
            await api.apiApproveEdit(editId, edit.listingId, edit.changes as Record<string, string>);
            // Also approve the listing itself
            await api.apiApproveListing(edit.listingId);
          } catch { /* local */ }
          set((st) => ({
            myListings: st.myListings.map((l) =>
              l.id === edit.listingId ? { ...l, active: true, verified: true } : l
            ),
            pendingEdits: st.pendingEdits.filter((e) => e.id !== editId),
          }));
        },

        rejectEdit: async (editId) => {
          try { await api.apiRejectEdit(editId); } catch { /* local */ }
          set((s) => ({ pendingEdits: s.pendingEdits.filter((e) => e.id !== editId) }));
        },

        clearModerationNotes: () => set({ moderationNoteCount: 0 }),

        removeListing: async (id) => {
          const s = get();
          const listing = s.myListings.find((l) => l.id === id);
          if (listing) {
            try { await api.apiRemoveListing(id, listing.hostId); } catch { /* local */ }
          }
          set((st) => ({ myListings: st.myListings.filter((l) => l.id !== id) }));
        },

        // ── Help ──
        setHelpContent: async (key, value) => {
          try { await api.apiSetHelpContent(key, value); } catch { /* local */ }
          set((s) => {
            const km: Record<string, string> = {
              howItWorks: "helpHowItWorks", faq: "helpFAQ", cancelPolicy: "helpCancelPolicy",
              support: "helpSupport", hostInfo: "helpHostInfo", rules: "helpRules",
              privacy: "helpPrivacy", terms: "helpTerms",
            };
            return { [km[key] ?? key]: value } as Partial<AppState>;
          });
        },

        // ── Banners ──
        addBanner: async (data) => {
          try {
            const row = await api.apiAddBanner(data as any);
            const banner: Banner = {
              id: row.id, title: row.title,
              imageUrl: row.imageUrl || row.image_url,
              linkUrl: row.linkUrl || row.link_url,
              htmlContent: row.htmlContent || row.html_content || data.htmlContent,
              slot: row.slot, active: row.active ?? true,
              impressions: row.impressions ?? 0, clicks: row.clicks ?? 0,
              startDate: row.startDate || row.start_date || "",
              endDate: row.endDate || row.end_date || null,
            };
            set((s) => ({ banners: [...s.banners, banner] }));
            return banner;
          } catch {
            const local: Banner = { ...data, id: `bnr-${Date.now()}`, impressions: 0, clicks: 0 };
            set((s) => ({ banners: [...s.banners, local] }));
            return local;
          }
        },

        updateBanner: async (id, data) => {
          try { await api.apiUpdateBanner(id, data); } catch { /* local */ }
          set((s) => ({ banners: s.banners.map((b) => b.id === id ? { ...b, ...data } : b) }));
        },

        removeBanner: async (id) => {
          try { await api.apiRemoveBanner(id); } catch { /* local */ }
          set((s) => ({ banners: s.banners.filter((b) => b.id !== id) }));
        },

        // ── DB loader ──
        loadFromDb: async () => {
          const s = get();
          try {
            const [banners, edits, helpContent] = await Promise.all([
              api.apiGetBanners().catch(() => null),
              api.apiGetPendingEdits().catch(() => null),
              api.apiGetHelpContent().catch(() => null),
            ]);

            if (banners) {
              const mapped: Banner[] = (banners as any[]).map((r: any) => ({
                id: r.id, title: r.title,
                imageUrl: r.imageUrl || r.image_url || "",
                linkUrl: r.linkUrl || r.link_url || "",
                htmlContent: r.htmlContent || r.html_content || undefined,
                slot: r.slot, active: r.active ?? true,
                impressions: r.impressions ?? 0, clicks: r.clicks ?? 0,
                startDate: r.startDate || r.start_date || "",
                endDate: r.endDate || r.end_date || "",
              }));
              set({ banners: mapped });
            }

            if (edits) {
              const mapped: PendingEdit[] = (edits as any[]).map((r: any) => ({
                id: r.id,
                listingId: r.listingId || r.listing_id,
                listingTitle: r.listingTitle || r.listing_title,
                hostId: r.hostId || r.host_id,
                hostName: r.hostName || r.host_name,
                submittedAt: r.submittedAt || r.submitted_at,
                changes: r.changes ?? {},
              }));
              set({ pendingEdits: mapped, moderationNoteCount: mapped.length });
            }

            if (helpContent) {
              const h = helpContent as Record<string, string>;
              set({
                helpHowItWorks: h.howItWorks || s.helpHowItWorks || "",
                helpFAQ: h.faq || s.helpFAQ || "",
                helpCancelPolicy: h.cancelPolicy || s.helpCancelPolicy || "",
                helpSupport: h.support || s.helpSupport || "",
                helpHostInfo: h.hostInfo || s.helpHostInfo || "",
                helpRules: h.rules || s.helpRules || "",
                helpPrivacy: h.privacy || s.helpPrivacy || "",
                helpTerms: h.terms || s.helpTerms || "",
              });
            }

            if (s.user) {
              const [listings, bookings] = await Promise.all([
                api.apiGetMyListings(s.user.id).catch(() => null),
                api.apiGetMyBookings(s.user.id).catch(() => null),
              ]);
              if (listings) {
                const mapped: HostListing[] = (listings as any[]).map((r: any) => ({
                  id: r.id,
                  hostId: r.hostId || r.host_id || "",
                  title: r.title,
                  type: r.type,
                  location: r.location,
                  price: typeof r.price === "number" ? r.price : (parseInt(String(r.price).replace(/\D/g, "")) || 0),
                  priceUnit: priceUnit(r.type),
                  rating: r.rating ?? null,
                  views: r.views ?? 0,
                  bookingsCount: r.bookingsCount ?? r.bookings_count ?? 0,
                  active: r.active ?? true,
                  verified: r.verified ?? false,
                  promo: r.promo ?? null,
                  coverImage: r.coverImage ?? r.cover_image ?? null,
                  images: r.images ?? [],
                  description: r.description,
                  maxGuests: r.maxGuests ?? r.max_guests,
                  roomsCount: r.roomsCount ?? r.rooms_count,
                  bedsCount: r.bedsCount ?? r.beds_count,
                  amenities: r.amenities ?? [],
                  season: r.season,
                  createdAt: r.createdAt ?? r.created_at,
                }));
                set({ myListings: mapped });
              }
              if (bookings) {
                const mapped: Booking[] = (bookings as any[]).map((r: any) => ({
                  id: r.id,
                  listingId: r.listingId || r.listing_id || "",
                  listingTitle: r.listingTitle || r.listing_title || "",
                  listingType: r.listingType || r.listing_type || "",
                  location: r.location || "",
                  guestId: r.guestId || r.guest_id || "",
                  guestName: r.guestName || r.guest_name || "",
                  hostName: r.hostName || r.host_name || "",
                  checkIn: r.checkIn || r.check_in || "",
                  checkOut: r.checkOut || r.check_out || "",
                  guests: r.guests ?? 1,
                  totalPrice: r.totalPrice ?? r.total_price ?? 0,
                  status: r.status ?? "pending",
                  createdAt: r.createdAt || r.created_at || "",
                }));
                set({ bookings: mapped });
              }
            }
          } catch {
            console.log("[SakhGO] DB unavailable, staying on localStorage");
          }
        },
      }),
      {
        name: "sakhalinstay-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          favorites: state.favorites,
          bookings: state.bookings,
          myListings: state.myListings,
          helpHowItWorks: state.helpHowItWorks,
          helpFAQ: state.helpFAQ,
          helpCancelPolicy: state.helpCancelPolicy,
          helpSupport: state.helpSupport,
          helpHostInfo: state.helpHostInfo,
          helpRules: state.helpRules,
          helpPrivacy: state.helpPrivacy,
          helpTerms: state.helpTerms,
          banners: state.banners,
          pendingEdits: state.pendingEdits,
          moderationNoteCount: state.moderationNoteCount,
        }),
      }
    )
);
