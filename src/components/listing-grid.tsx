"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, HostListing, labelFromType, formatPrice, priceUnit } from "@/lib/store";
import { apiExpirePromotions } from "@/lib/api";
import { apiIncrementPromoClick } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MapPin, Star, Heart, ImageIcon } from "lucide-react";

const TYPE_BG: Record<string, string> = {
  property: "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]",
  tour: "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]",
  fishing: "from-[#70A8B0] via-[#388890] to-[#186068]",
  rental_gear: "from-[#C8C0B8] via-[#A09888] to-[#686050]",
  car_rental: "from-[#4A6FA5] via-[#2E5090] to-[#1A3A6E]",
};
const TYPE_ICON: Record<string, string> = {
  property: "🏠",
  tour: "🎒",
  fishing: "🎣",
  rental_gear: "🎿",
  car_rental: "🚗",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Всё" },
  { value: "property", label: "Жильё" },
  { value: "tour", label: "Туры" },
  { value: "fishing", label: "Рыбалка" },
  { value: "rental_gear", label: "Снаряжение" },
  { value: "car_rental", label: "Прокат авто" },
];

interface Props {
  quickPick: string | null;
}

export function ListingGrid({ quickPick }: Props) {
  const store = useStore();
  const router = useRouter();

  useEffect(() => {
    store.loadCatalog({ sort: "rating", limit: 12 });
    // Auto-expire stale promotions on every page visit
    apiExpirePromotions().catch(() => {});
  }, []);

  const listings: HostListing[] = store.catalogListings.length > 0
    ? store.catalogListings
    : [];

  // Map quickPick IDs to listing types
  const QUICK_PICK_TYPE: Record<string, string> = {
    mountain: "property",
    sea: "tour",
    jeep: "tour",
    fishing: "fishing",
    car_rental: "car_rental",
  };

  const filtered = listings.filter((l) => {
    if (quickPick && QUICK_PICK_TYPE[quickPick]) return l.type === QUICK_PICK_TYPE[quickPick];
    if (store.activeFilter !== "all" && l.type !== store.activeFilter) return false;
    return true;
  });

  const loading = store.catalogLoading && filtered.length === 0;

  return (
    <section className="py-12 md:py-16 bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-accent font-medium">Популярное сейчас</span>
            <h2 className="font-display text-4xl mt-1">Выбор путешественников</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full text-sm font-medium",
                  store.activeFilter === f.value ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => store.setActiveFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Загрузка объявлений...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((l) => {
              const hasImage = !!(l.coverImage || (l.images && l.images.length > 0));
              const bg = TYPE_BG[l.type] || "from-slate-200 via-slate-300 to-slate-400";
              const icon = TYPE_ICON[l.type] || "📦";
              return (
                <Card
                  key={l.id}
                  className={cn(
                    "group overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer",
                    l.promo === "highlight" && "ring-2 ring-violet-500/50",
                    l.promo === "top" && "ring-2 ring-amber-500/50"
                  )}
                  onClick={() => {
                    if (l.promo) apiIncrementPromoClick(l.id).catch(() => {});
                    router.push(`/listings/${l.id}`);
                  }}
                >
                  <div className={cn("aspect-[4/3] relative overflow-hidden", !hasImage && "bg-gradient-to-br " + bg)}>
                    {hasImage ? (
                      <img src={l.coverImage || l.images![0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl">{icon}</span>
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute top-3 left-3 bg-white/90 text-foreground border font-mono text-[11px]">
                      {labelFromType(l.type)}
                    </Badge>
                    {l.promo && (
                      <Badge className={cn(
                        "absolute top-3 right-3 font-mono text-[11px]",
                        l.promo === "top" && "bg-amber-500 text-white",
                        l.promo === "highlight" && "bg-violet-500 text-white"
                      )}>
                        {l.promo === "top" ? "ТОП" : "Премиум"}
                      </Badge>
                    )}
                    <button
                      className={cn(
                        "absolute right-3 w-8 h-8 rounded-full bg-white/90 border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors",
                        l.promo ? "bottom-3" : "top-3"
                      )}
                      onClick={(e) => { e.stopPropagation(); store.toggleFavorite(l.id); }}
                    >
                      <Heart className={cn("w-4 h-4", store.isFavorite(l.id) ? "fill-accent text-accent" : "")} />
                    </button>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-widest text-accent font-medium mb-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{l.location}
                    </p>
                    <h3 className="font-display text-lg leading-tight mb-2 text-foreground line-clamp-1">{l.title}</h3>
                    <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                      {l.type === 'property' && l.roomsCount && <span>{l.roomsCount} комн.</span>}
                      {l.maxGuests && (l.type === 'property' || l.type === 'tour' || l.type === 'fishing') && <span>до {l.maxGuests} гостей</span>}
                      {l.tourDurationDays && (l.type === 'tour' || l.type === 'fishing') && <span>{l.tourDurationDays} дн.</span>}
                      {l.amenities && l.amenities.slice(0, 1).map((a, i) => <span key={i}>{a}</span>)}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div>
                        <span className="font-display text-xl">{formatPrice(l.price || 0)}</span>
                        <span className="text-xs text-muted-foreground ml-1">{priceUnit(l.type)}</span>
                      </div>
                      {l.rating != null && (
                        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                          <Star className="w-3.5 h-3.5 text-amber fill-amber" />
                          {Number(l.rating).toFixed(1)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Ничего не найдено</p>
            {quickPick ? (
              <>
                <p className="text-sm mt-1 mb-4">В этой категории пока нет объявлений. Станьте первым!</p>
                <Button variant="outline" onClick={() => router.push("/dashboard/create")}>Подать объявление</Button>
              </>
            ) : store.activeFilter !== "all" ? (
              <>
                <p className="text-sm mt-1 mb-4">В этой категории пока нет объявлений</p>
                <Button variant="outline" onClick={() => store.setActiveFilter("all")}>Показать все</Button>
              </>
            ) : (
              <>
                <p className="text-sm mt-1 mb-4">Станьте первым организатором</p>
                <Button variant="outline" onClick={() => router.push("/dashboard/create")}>Подать объявление</Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
