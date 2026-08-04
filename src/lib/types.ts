export type ListingType = "property" | "tour" | "rental_gear" | "fishing" | "car_rental";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "rejected";
export type SeasonType = "winter" | "summer" | "all_season";
export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_verified: boolean;
  bio: string | null;
  location_tag: string | null;
}

export interface Listing {
  id: string;
  host_id: string;
  listing_type: ListingType;
  category_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  price_per_night: number;
  currency: string;
  max_guests: number;
  location_tag: string;
  address: string | null;
  requires_border_permit: boolean;
  season: SeasonType;
  transport_type: string | null;
  rooms_count: number | null;
  beds_count: number | null;
  amenities: string[];
  tour_duration_hours: number | null;
  tour_duration_days: number | null;
  difficulty_level: string | null;
  includes: string[];
  gear_condition: string | null;
  equipment_list: string[];
  fishing_type: string | null;
  fish_species: string[];
  fishing_method: string | null;
  gear_included: boolean;
  catch_guarantee: string | null;
  license_required: boolean;
  boat_included: boolean;
  meals_included: boolean;
  images: string[];
  cover_image: string | null;
  is_active: boolean;
  is_verified: boolean;
  view_count: number;
  avg_rating: number | null;
}

export interface Booking {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  status: BookingStatus;
  total_price: number;
  deposit_paid: boolean;
  guest_message: string | null;
  host_response: string | null;
  listing?: Listing;
  guest?: Profile;
  host?: Profile;
}

export interface Promotion {
  id: string;
  listing_id: string;
  host_id: string;
  promo_type: "top" | "highlight" | "urgent";
  status: "draft" | "active" | "paused" | "expired" | "archived";
  starts_at: string;
  expires_at: string;
  budget_rub: number;
  payment_status: "pending" | "paid" | "refunded" | "failed";
  payment_amount: number;
}

export interface Category {
  id: string;
  slug: string;
  name_ru: string;
  listing_type: ListingType;
  icon_name: string | null;
  parent_id: string | null;
  sort_order: number;
}
