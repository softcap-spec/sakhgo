"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, HostListing, labelFromType, formatPrice, priceUnit } from "@/lib/store";
import * as api from "@/lib/api";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LISTING_LABELS } from "@/lib/data";
import { ListingType } from "@/lib/types";
import {
  ArrowLeft, Heart, MapPin, Star, Users, Calendar,
  CheckCircle, ChevronLeft, ChevronRight, Pencil,
} from "lucide-react";
import { ReviewsSection } from "@/components/reviews-section";
import { CrossSellPanel } from "@/components/cross-sell-panel";

const TYPE_BG: Record<string, string> = {
  property: "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]",
  tour: "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]",
  fishing: "from-[#70A8B0] via-[#388890] to-[#186068]",
  rental_gear: "from-[#C8C0B8] via-[#A09888] to-[#686050]",
  car_rental: "from-[#B8C8D0] via-[#688898] to-[#385060]",
};

type ListingFull = HostListing & {
  slug?: string;
  hostName?: string;
  hostAvatar?: string;
  reviewsCount?: number;
};

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useStore();
  const router = useRouter();
  const liked = store.isFavorite(id);

  const [listing, setListing] = useState<ListingFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);

  // Fetch from API on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Admin can view any listing (including pending/unverified)
        const isAdmin = store.user?.role === 'admin';
        const data = isAdmin
          ? await api.apiGetListingByIdAdmin(id)
          : await api.apiGetListingById(id);
        setListing(data as ListingFull);
      } catch {
        // Fallback: search in local store
        const local = store.myListings.find(l => l.id === id);
        if (local && (local.active || store.user?.role === 'admin')) {
          setListing(local);
        } else {
          setListing(null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, store.user]);

  // Booking state
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("1");
  const [bookingDone, setBookingDone] = useState(false);
  const [lastBookingId, setLastBookingId] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  if (loading) {
    return (
      <>
        <Header /><AuthModal />
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Загрузка...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Header /><AuthModal />
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl mb-4">Объявление не найдено</h1>
          <p className="text-muted-foreground mb-6">Возможно, оно было удалено или ещё не прошло модерацию.</p>
          <Button onClick={() => router.push("/catalog")}>Вернуться в каталог</Button>
        </main>
        <Footer />
      </>
    );
  }

  const displayPrice = listing.price || 0;
  const hostName = listing.hostName || "Организатор";
  const hostInitial = hostName[0] || "О";
  const isOwner = store.user && (listing.hostId === store.user.id || store.user.role === "admin");
  const allImages = listing.images || (listing.coverImage ? [listing.coverImage] : []);

  const nights = checkin && checkout
    ? Math.max(1, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000))
    : 1;
  const total = listing.type === 'rental_gear' ? displayPrice : displayPrice * nights;

  const handleBooking = async () => {
    if (!store.user) { store.setAuthOpen(true); return; }
    const effectiveCheckout = listing.type === 'fishing' ? checkin : checkout;
    if (!checkin || !effectiveCheckout) { alert("Выберите даты"); return; }
    const b = await store.addBooking({
      listingId: listing.id, listingTitle: listing.title,
      listingType: listing.type, location: listing.location,
      guestId: store.user.id, guestName: store.user.name,
      hostName, checkIn: checkin, checkOut: effectiveCheckout,
      guests: parseInt(guests), totalPrice: total,
      status: "pending",
    });
    setLastBookingId(b.id);
    setBookingDone(true);
  };

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => router.push("/catalog")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Назад в каталог
        </button>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Left: gallery + details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Cover / Gallery */}
            <div className="relative">
              <div className={cn("aspect-[16/9] rounded-xl overflow-hidden relative",
                allImages.length === 0 && `bg-gradient-to-br ${TYPE_BG[listing.type] || "from-slate-200 via-slate-300 to-slate-400"}`
              )}>
                {allImages.length > 0 ? (
                  <>
                    <img src={allImages[currentImage] || allImages[0]} alt={listing.title} className="w-full h-full object-cover" />
                    {/* Watermark */}
                    <div className="absolute bottom-4 right-4 pointer-events-none opacity-20">
                      <img src="/logo.png" alt="" className="w-24 h-auto object-contain" />
                    </div>
                  </>
                ) : (
                  <span className="absolute bottom-3 right-3 text-white/80 text-2xl font-mono bg-black/30 px-2 py-0.5 rounded">
                    {listing.type === "property" ? "🏠" : listing.type === "tour" ? "🏔️" : listing.type === "fishing" ? "🎣" : "🔧"}
                  </span>
                )}
                {listing.season && listing.season !== "all_season" && (
                  <span className="absolute top-3 left-3 bg-white/90 text-foreground text-xs font-medium px-2.5 py-1 rounded-full border">
                    {{ winter: "❄️ Зима", summer: "☀️ Лето" }[listing.season] || listing.season}
                  </span>
                )}
              </div>
              {allImages.length > 1 && (
                <>
                  <button onClick={() => setCurrentImage(i => (i - 1 + allImages.length) % allImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCurrentImage(i => (i + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="flex justify-center gap-1 mt-2">
                    {allImages.map((_, i) => (
                      <button key={i} onClick={() => setCurrentImage(i)}
                        className={`w-2 h-2 rounded-full ${i === currentImage ? "bg-accent" : "bg-muted"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2">{labelFromType(listing.type)}</Badge>
                  <h1 className="font-display text-3xl sm:text-4xl leading-[1.1]">{listing.title}</h1>
                  <p className="flex items-center gap-1 text-muted-foreground mt-2">
                    <MapPin className="w-4 h-4" />{listing.location}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl">{formatPrice(displayPrice)}</div>
                  <div className="text-sm text-muted-foreground">{priceUnit(listing.type)}</div>
                </div>
              </div>
              <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
                {listing.rating != null && (
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />{Number(listing.rating).toFixed(1)}</span>
                )}
                <span>{listing.views ?? 0} просмотров · {listing.bookingsCount ?? 0} брони</span>
              </div>
            </div>

            <Separator />

            {/* Description */}
            {listing.description && (
              <div>
                <h2 className="font-display text-xl mb-3">Описание</h2>
                <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div>
              <h2 className="font-display text-xl mb-3">Характеристики</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {listing.season && listing.season !== "all_season" && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-sm">{
                      { winter: "Зима", summer: "Лето", all_season: "Круглый год" }[listing.season] || listing.season
                    }</div>
                    <div className="text-xs text-muted-foreground">Сезон</div>
                  </div>
                )}
                {listing.maxGuests && listing.type !== 'rental_gear' && listing.type !== 'car_rental' && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-xl">{listing.maxGuests}</div>
                    <div className="text-xs text-muted-foreground">Гостей</div>
                  </div>
                )}
                {listing.type === 'property' && listing.roomsCount && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-xl">{listing.roomsCount}</div>
                    <div className="text-xs text-muted-foreground">Комнат</div>
                  </div>
                )}
                {listing.type === 'property' && listing.bedsCount && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-xl">{listing.bedsCount}</div>
                    <div className="text-xs text-muted-foreground">Спальных мест</div>
                  </div>
                )}
                {listing.tourDurationDays && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-xl">{listing.tourDurationDays}</div>
                    <div className="text-xs text-muted-foreground">Дней</div>
                  </div>
                )}
                {listing.difficultyLevel && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-xl">{
                      { easy: "Лёгкий", medium: "Средний", hard: "Сложный", extreme: "Экстр." }[listing.difficultyLevel] || listing.difficultyLevel
                    }</div>
                    <div className="text-xs text-muted-foreground">Сложность</div>
                  </div>
                )}
                {listing.gearCondition && (
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="font-display text-sm">{listing.gearCondition}</div>
                    <div className="text-xs text-muted-foreground">Состояние</div>
                  </div>
                )}
              </div>
            </div>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div>
                <h2 className="font-display text-xl mb-3">Удобства</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a) => (
                    <Badge key={a} variant="outline" className="text-sm py-1.5 px-3">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tour specifics */}
            {listing.type === "tour" && (
              <div className="space-y-2">
                <h2 className="font-display text-xl mb-3">Детали тура</h2>
                {listing.includes && listing.includes.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Что включено:</span>
                    <div className="flex flex-wrap gap-2">
                      {listing.includes.map((item, i) => <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>)}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {listing.requiresBorderPermit && <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">Погранпропуск</Badge>}
                  {listing.transportIncluded && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Трансфер включён</Badge>}
                </div>
              </div>
            )}

            {/* Fishing specifics */}
            {listing.type === "fishing" && (
              <div className="space-y-3">
                <h2 className="font-display text-xl mb-3">Параметры рыбалки</h2>
                {listing.fishingType && <p className="text-sm text-muted-foreground">Тип: {{ rechnaya: "Речная", morskaya: "Морская", ozernaya: "Озёрная", podlednaya: "Подлёдная", splav: "Сплав" }[listing.fishingType] || listing.fishingType}</p>}
                {listing.fishSpecies && listing.fishSpecies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {listing.fishSpecies.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {listing.gearIncluded && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Снаряжение вкл.</Badge>}
                  {listing.boatIncluded && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Катер вкл.</Badge>}
                  {listing.mealsIncluded && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Питание вкл.</Badge>}
                  {listing.licenseRequired && <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">Лицензия</Badge>}
                  {listing.catchGuarantee && <Badge variant="outline" className="text-xs">{listing.catchGuarantee}</Badge>}
                </div>
              </div>
            )}

            {/* Owner actions */}
            {isOwner && (
              <>
                <Separator />
                <div>
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => router.push(`/dashboard/host/edit/${listing.id}`)}>
                    <Pencil className="w-4 h-4" /> Редактировать объявление
                  </Button>
                </div>
              </>
            )}

            {/* ── Reviews Section ── */}
            <ReviewsSection listingId={listing.id} listingTitle={listing.title} />
          </div>

          {/* Right: booking widget + host */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="text-center">
                  <span className="font-display text-3xl">{formatPrice(displayPrice)}</span>
                  <span className="text-sm text-muted-foreground ml-1">{priceUnit(listing.type)}</span>
                </div>
                {listing.type === 'rental_gear' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Дата бронирования</Label>
                    <Input type="date" value={checkin} onChange={(e) => { setCheckin(e.target.value); setCheckout(e.target.value); }} className="h-10" />
                  </div>
                ) : (listing.type === 'fishing' || listing.type === 'tour') ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Дата</Label>
                      <Input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Гостей</Label>
                      <select value={guests} onChange={(e) => setGuests(e.target.value)}
                        className="w-full h-10 px-3 border rounded-lg text-sm bg-background">
                        {[1,2,3,4,5,6,8,10].map(n => <option key={n} value={n}>{n} {n===1?"гость":n<5?"гостя":"гостей"}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Заезд</Label>
                        <Input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className="h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Выезд</Label>
                        <Input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} className="h-10" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Гостей</Label>
                      <select value={guests} onChange={(e) => setGuests(e.target.value)}
                        className="w-full h-10 px-3 border rounded-lg text-sm bg-background">
                        {[1,2,3,4,5,6,8,10].map(n => <option key={n} value={n}>{n} {n===1?"гость":n<5?"гостя":"гостей"}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {checkin && checkout && (
                  <div className="space-y-2 bg-muted/30 rounded-lg p-3 text-sm">
                    {listing.type !== 'rental_gear' && listing.type !== 'fishing' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{formatPrice(displayPrice)} × {nights} {nights===1?"ночь":nights<5?"ночи":"ночей"}</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Итого</span>
                      <span className="font-display text-lg">{formatPrice(total)}</span>
                    </div>
                  </div>
                )}
                {!bookingDone ? (
                  <>
                    <Button className="w-full bg-green-700 hover:bg-green-800 text-white" size="lg" onClick={handleBooking} disabled={!checkin || (listing.type !== 'fishing' && listing.type !== 'rental_gear' ? !checkout : false)}>
                      {store.user ? "Забронировать" : "Войдите, чтобы забронировать"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">Расчёты производятся напрямую с организатором</p>
                    {store.user && store.user.id !== listing.hostId && (
                      <Button variant="default" size="lg" className="w-full bg-accent hover:bg-accent-hover text-white" onClick={() => (window as any).__sakhgoOpenChat?.(listing.id, listing.title, (listing.images?.[0] || listing.coverImage || null), listing.hostId, hostName, listing.hostAvatar)}>
                        Написать
                      </Button>
                    )}
                    {listing.hostPhone && (
                      <div className="text-center">
                        {showPhone ? (
                          <a href={`tel:${listing.hostPhone}`} className="text-sm font-medium text-accent hover:underline">
                            {listing.hostPhone}
                          </a>
                        ) : (
                          <Button variant="default" size="lg" className="w-full bg-accent hover:bg-accent-hover text-white" onClick={() => setShowPhone(true)}>
                            Показать телефон
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                    <p className="font-medium text-green-800">Бронь отправлена!</p>
                    <p className="text-sm text-green-700">{listing.type === 'rental_gear' || listing.type === 'fishing' ? checkin : `${checkin} — ${checkout} · ${guests} чел.`} · {formatPrice(total)}</p>
                    <p className="text-xs text-green-600">Ожидайте подтверждения от {hostName}</p>
                    <Button variant="outline" size="sm" className="mt-1" onClick={() => router.push("/dashboard")}>В кабинет →</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-start gap-4">
                <Avatar className="w-12 h-12">
                  {listing.hostAvatar ? <img src={listing.hostAvatar} alt="" className="w-full h-full object-cover rounded-full" /> : <AvatarFallback className="bg-accent text-accent-fg text-lg">{hostInitial}</AvatarFallback>}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{hostName}</h3>
                    <CheckCircle className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Организатор · {listing.rating != null ? `★ ${Number(listing.rating).toFixed(1)}` : 'Нет рейтинга'}</p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Принимает гостей на Сахалине.</p>
                </div>
              </CardContent>
            </Card>

            {/* ── Cross-sell ── */}
            <CrossSellPanel listingId={listing.id} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
