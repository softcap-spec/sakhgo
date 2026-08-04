"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LOCATIONS, LISTING_LABELS } from "@/lib/data";
import { ListingType } from "@/lib/types";
import { useStore, HostListing, labelFromType, formatPrice, priceUnit } from "@/lib/store";
import { apiExpirePromotions } from "@/lib/api";
import {
  Heart, MapPin, Star, X, SlidersHorizontal, ArrowUpDown, Flame,
} from "lucide-react";

type SortOption = "price_asc" | "top" | "rating";

const AMENITY_FILTERS = [
  { id: "wifi", label: "Wi-Fi" },
  { id: "gear_dryer", label: "Сушилка для снаряжения/лыж" },
  { id: "mountain_view", label: "Вид на горы" },
  { id: "sea_view", label: "Вид на море" },
  { id: "parking", label: "Парковка" },
  { id: "sauna", label: "Баня/Сауна" },
  { id: "transfer", label: "Трансфер из Южно-Сахалинска" },
  { id: "border_permit", label: "Погранпропуск (Курилы)" },
  { id: "weather_dependent", label: "По погоде/шторму" },
  { id: "gear_included", label: "Снаряжение включено" },
  { id: "license_required", label: "Нужна лицензия/путёвка" },
  { id: "boat_included", label: "Катер/лодка включены" },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof ArrowUpDown }[] = [
  { value: "price_asc", label: "Сначала дешевле", icon: ArrowUpDown },
  { value: "top", label: "Сначала продвигаемые", icon: Flame },
  { value: "rating", label: "По рейтингу", icon: Star },
];

const TYPE_BG: Record<string, string> = {
  property: "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]",
  tour: "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]",
  fishing: "from-[#70A8B0] via-[#388890] to-[#186068]",
  rental_gear: "from-[#C8C0B8] via-[#A09888] to-[#686050]",
  car_rental: "from-[#B8C8D0] via-[#688898] to-[#385060]",
};

function CatalogContent() {
  const store = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("q") || "";

  const [typeFilter, setTypeFilter] = useState<ListingType | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>("rating");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load catalog from DB on mount or when URL search changes
  useEffect(() => {
    const filters: Record<string, unknown> = { sort: "rating", limit: 50 };
    if (urlSearch) filters.search = urlSearch;
    store.loadCatalog(filters);
    apiExpirePromotions().catch(() => {});
  }, [urlSearch]);

  // Reload on filter change
  useEffect(() => {
    const filters: Record<string, unknown> = { sort, limit: 50 };
    if (urlSearch) filters.search = urlSearch;
    if (typeFilter !== "all") filters.type = typeFilter;
    if (locationFilter) filters.location = locationFilter;
    if (priceMin) filters.minPrice = Number(priceMin);
    if (priceMax) filters.maxPrice = Number(priceMax);
    store.loadCatalog(filters);
  }, [typeFilter, locationFilter, priceMin, priceMax, sort, urlSearch]);

  const toggleAmenity = (id: string) => {
    const next = new Set(selectedAmenities);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedAmenities(next);
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setLocationFilter("");
    setPriceMin("");
    setPriceMax("");
    setSelectedAmenities(new Set());
  };

  const hasFilters = typeFilter !== "all" || locationFilter !== "" || priceMin !== "" || priceMax !== "" || selectedAmenities.size > 0;

  let items: HostListing[] = store.catalogListings.length > 0 || hasFilters
    ? store.catalogListings
    : store.myListings.filter(l => l.active && l.verified);

  if (selectedAmenities.size > 0 && store.catalogListings.length === 0) {
    items = items.filter(l => {
      const a = l.amenities || [];
      return Array.from(selectedAmenities).every(am => a.some(item => item.toLowerCase().includes(am)));
    });
  }

  if (sort === "price_asc") {
    items = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === "rating") {
    items = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl">
            {urlSearch ? `Поиск: «${urlSearch}»` : "Каталог объявлений"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {store.catalogLoading ? "Загрузка..." : `${items.length} вариантов`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex items-center gap-2"><o.icon className="w-4 h-4" />{o.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="lg:hidden gap-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <SlidersHorizontal className="w-4 h-4" /> Фильтры
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className={`${
          sidebarOpen
            ? "fixed inset-0 z-40 bg-background p-6 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0 lg:overflow-visible"
            : "hidden"
        } lg:block w-full lg:w-64 shrink-0 space-y-6`}>
          {sidebarOpen && (
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h3 className="font-display text-xl">Фильтры</h3>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></Button>
            </div>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={clearFilters}>
              <X className="w-3 h-3" /> Сбросить все фильтры
            </Button>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted">Тип</Label>
            <div className="space-y-1">
              <button onClick={() => setTypeFilter("all")}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${typeFilter === "all" ? "bg-accent text-accent-fg" : "hover:bg-muted/50 text-muted-foreground"}`}
              >Все категории</button>
              {(Object.entries(LISTING_LABELS) as [ListingType, string][]).map(([k, v]) => (
                <button key={k} onClick={() => setTypeFilter(k)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${typeFilter === k ? "bg-accent text-accent-fg" : "hover:bg-muted/50 text-muted-foreground"}`}
                >{v}</button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted">Локация</Label>
            <Select value={locationFilter} onValueChange={(v) => setLocationFilter((v ?? "") === "all" ? "" : v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Все локации" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все локации</SelectItem>
                {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted">Цена, ₽</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="От" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-9" />
              <Input type="number" placeholder="До" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-9" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted">Удобства и условия</Label>
            <div className="space-y-2">
              {AMENITY_FILTERS.map((a) => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedAmenities.has(a.id) ? "bg-accent border-accent text-white" : "border-border"}`}>
                    {selectedAmenities.has(a.id) && <span className="text-[10px] leading-none">✓</span>}
                  </div>
                  <input type="checkbox" className="sr-only" checked={selectedAmenities.has(a.id)} onChange={() => toggleAmenity(a.id)} />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {store.catalogLoading && items.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg">Загрузка объявлений...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              {urlSearch ? (
                <>
                  <p className="text-lg">Ничего не найдено</p>
                  <p className="text-sm mt-1 mb-4">По запросу «{urlSearch}» ничего не найдено. Попробуйте изменить запрос.</p>
                  <Button variant="outline" onClick={() => router.push("/catalog")}>Смотреть все объявления</Button>
                </>
              ) : (
                <>
                  <p className="text-lg">Объявлений пока нет</p>
                  <p className="text-sm mt-1 mb-4">Станьте первым хостом на платформе</p>
                  <Button variant="outline" onClick={() => router.push("/dashboard/host/create")}>Создать объявление</Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((l) => (
                <Card
                  key={l.id}
                  className="group overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
                  onClick={() => router.push(`/listings/${l.id}`)}
                >
                  <div className={`aspect-[4/3] relative overflow-hidden ${l.coverImage || l.images?.length ? '' : 'bg-gradient-to-br ' + (TYPE_BG[l.type] || 'from-slate-200 via-slate-300 to-slate-400')}`}>
                    {(l.coverImage || (l.images && l.images.length > 0)) ? (
                      <img src={l.coverImage || l.images![0]} alt={l.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display italic text-4xl text-white/25">
                          {l.type === "property" ? "🏠" : l.type === "tour" ? "🏔️" : l.type === "fishing" ? "🎣" : "🔧"}
                        </span>
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute top-3 left-3 bg-white/90 text-foreground border font-mono text-[11px]">
                      {labelFromType(l.type)}
                    </Badge>
                    {l.promo && (
                      <Badge variant="secondary" className="absolute top-3 right-12 bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                        {l.promo === "top" ? "Топ" : l.promo === "highlight" ? "Выбор" : "Срочно"}
                      </Badge>
                    )}
                    <button
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
                      onClick={(e) => { e.stopPropagation(); store.toggleFavorite(l.id); }}
                    >
                      <Heart className={`w-4 h-4 ${store.isFavorite(l.id) ? "fill-accent text-accent" : ""}`} />
                    </button>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-widest text-accent font-medium mb-0.5">
                      <MapPin className="w-3 h-3 inline mr-0.5" />{l.location}
                    </p>
                    <h3 className="font-display text-lg leading-tight mb-2">{l.title}</h3>
                    <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                      {l.type === 'property' && l.roomsCount && <span>{l.roomsCount} комн.</span>}
                      {l.maxGuests && l.type !== 'rental_gear' && <span>до {l.maxGuests} гостей</span>}
                      {l.tourDurationDays && <span>{l.tourDurationDays} дн.</span>}
                      {l.amenities && l.amenities.slice(0, 2).map((a, i) => <span key={i}>{a}</span>)}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CatalogPage() {
  return (
    <>
      <Header />
      <AuthModal />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C5D5E4]" /></div>}>
        <CatalogContent />
      </Suspense>
      <Footer />
    </>
  );
}
