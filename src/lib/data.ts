import { ListingType } from "./types";

export const LOCATIONS = [
  "Южно-Сахалинск",
  "Корсаков",
  "Холмск",
  "Невельск",
  "Курильск",
  "Северо-Курильск",
  "Южно-Курильск",
  "Оха",
  "Ноглики",
  "Анива",
] as const;

export const LISTING_LABELS: Record<ListingType, string> = {
  property: "Жильё",
  tour: "Тур",
  rental_gear: "Снаряжение",
  fishing: "Рыбалка",
  car_rental: "Прокат авто",
};

// QuickPicks now live from DB via getQuickPickCounts API
export const QUICK_PICK_IDS = ["mountain", "sea", "jeep", "fishing"] as const;
