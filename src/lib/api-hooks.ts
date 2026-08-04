import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useStore } from "@/lib/store";
import type { ListingType } from "@/lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ListingFilters {
  type?: ListingType;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  guests?: number;
  amenities?: string[];
  sort?: "price_asc" | "top" | "rating";
  search?: string;
}

// ============================================================
// useListings — каталог с фильтрами (live from DB)
// ============================================================
export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: ["listings", filters],
    queryFn: async () => {
      const data = await api.apiGetPublicListings({
        ...filters,
        sort: filters.sort ?? "rating",
        limit: 12,
      });
      return (data as any)?.listings ?? [];
    },
    staleTime: 30_000,
  });
}

// ============================================================
// useListing — детальная страница (live from DB)
// ============================================================
export function useListing(id: string) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const data = await api.apiGetListingById(id);
      if (!data) throw new Error("Объявление не найдено");
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ============================================================
// useBooking — создание бронирования
// ============================================================
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      listingId: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      totalPrice: number;
    }) => {
      await delay(300);
      console.log("[Booking] Created:", data);
      return { id: `booking-${Date.now()}`, ...data, status: "pending" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

// useFavorites — через Zustand (без моков)
export function useFavorites() {
  const store = useStore();
  const favoriteIds = store.favorites;

  return useQuery({
    queryKey: ["favorites", [...favoriteIds].sort()],
    queryFn: async () => {
      // Возвращаем реальные объявления из каталога по ID избранного
      const data = await api.apiGetPublicListings({ limit: 50 }) as any;
      const listings = data?.listings ?? [];
      return listings.filter((l: any) => favoriteIds.includes(l.id));
    },
    staleTime: 10_000,
  });
}

// usePromotions — список продвижений (для админки)
export function usePromotions() {
  return useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      await delay(100);
      return [
        { id: "pm1", host: "Елена М.", listing: "Джип-тур на Мыс Великан", type: "top", price: 2990, date: "27.07.2026", status: "paid" },
        { id: "pm2", host: "Сергей К.", listing: "Морская рыбалка на кунджу", type: "hot", price: 990, date: "26.07.2026", status: "paid" },
        { id: "pm3", host: "Марина С.", listing: "Квартира-студия в центре", type: "highlight", price: 1490, date: "25.07.2026", status: "paid" },
        { id: "pm4", host: "Дмитрий В.", listing: "Тур на Итуруп", type: "top", price: 2990, date: "24.07.2026", status: "refunded" },
        { id: "pm5", host: "Елена М.", listing: "Квартира у Горного Воздуха", type: "highlight", price: 1490, date: "23.07.2026", status: "paid" },
      ];
    },
    staleTime: 30_000,
  });
}
