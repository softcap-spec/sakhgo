"use client";

import { useState, useEffect } from "react";
import { useStore, HostListing, labelFromType, formatPrice, priceUnit } from "@/lib/store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { PromoteModal } from "@/components/promote-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiCreatePromotion, apiInitYooKassaPayment, apiSimulatePayment } from "@/lib/api";
import { ArrowLeft, Building2, Calendar, CheckCircle, Key, Lock, MapPin, Megaphone, Pencil, Plus, Star, ToggleLeft, Trash2, XCircle } from "lucide-react";

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-yellow-100 text-yellow-800", label: "Ожидает" },
  confirmed: { class: "bg-green-100 text-green-800", label: "Подтверждено" },
  rejected: { class: "bg-red-100 text-red-800", label: "Отклонено" },
};

type PromoType = "top" | "urgent" | "highlight";

export default function HostDashboard() {
  const store = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"listings" | "bookings" | "profile">("listings");
  const [promoListing, setPromoListing] = useState<{ id: string; title: string; promo: PromoType | null } | null>(null);

  // Profile state
  const [profileName, setProfileName] = useState(store.user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(store.user?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(store.user?.phone ?? "");
  const [profileLocation, setProfileLocation] = useState("Южно-Сахалинск");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Password change state
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);

  const PASSWORD_REGEX = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\|,.<>/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\|,.<>/?]{8,}$/;

  const handleChangePassword = async () => {
    setPassError(""); setPassSuccess(false);
    if (!currentPass) { setPassError("Введите текущий пароль"); return; }
    if (newPass.length < 8) { setPassError("Новый пароль должен быть не менее 8 символов"); return; }
    if (!PASSWORD_REGEX.test(newPass)) { setPassError("Пароль должен содержать хотя бы один спецсимвол"); return; }
    if (newPass !== newPassConfirm) { setPassError("Пароли не совпадают"); return; }
    if (!store.user) return;
    try {
      const api = await import("@/lib/api");
      const result = await api.apiChangePassword(store.user.id, currentPass, newPass);
      if (!result) { setPassError("Неверный текущий пароль"); return; }
      setPassSuccess(true);
      setCurrentPass(""); setNewPass(""); setNewPassConfirm("");
      setTimeout(() => setPassSuccess(false), 3000);
    } catch (e: any) {
      setPassError(e?.message || "Ошибка смены пароля");
    }
  };

  useEffect(() => { if (!store.user) router.push("/"); }, [store.user, router]);

  if (!store.user) return null;

  const allListings = store.myListings.filter(
    (l) => l.hostId === store.user!.id || store.user!.role === "admin"
  );
  const incoming = store.bookings
    .filter((b) => b.hostName === store.user!.name || store.user!.role === "admin")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formatDates = (checkIn: string, checkOut: string, listingType: string) => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    if (checkIn === checkOut || listingType !== "property") {
      return `${d1.getDate()} ${months[d1.getMonth()]} ${d1.getFullYear()} · 1 день`;
    }
    const nights = Math.round((d2.getTime() - d1.getTime()) / 86400000);
    return `${d1.getDate()} ${months[d1.getMonth()]} — ${d2.getDate()} ${months[d2.getMonth()]} ${d2.getFullYear()} · ${nights} ${nights === 1 ? "ночь" : nights < 5 ? "ночи" : "ночей"}`;
  };

  const handleBookingAction = (bid: string, action: "confirm" | "reject") =>
    store.updateBookingStatus(bid, action === "confirm" ? "confirmed" : "rejected");

  const handlePromoApply = async (type: PromoType, durationDays: number, price: number) => {
    if (!promoListing || !store.user) return;
    try {
      const promo = await apiCreatePromotion({
        listing_id: promoListing.id,
        host_id: store.user.id,
        host_name: store.user.name,
        listing_title: promoListing.title,
        promo_type: type,
        duration_days: durationDays,
        price,
      });
      if (promo?.ok && promo.data?.id) {
        const payment = await apiInitYooKassaPayment({
          promotionId: promo.data.id,
          hostId: store.user.id,
          listingTitle: promoListing.title,
          amountRub: price,
        });
        if (payment?.ok && payment.paymentUrl) {
          window.location.href = payment.paymentUrl;
        } else {
          await apiSimulatePayment(promo.data.id);
          store.updateListing(promoListing.id, { promo: type } as any);
        }
      }
    } catch (e) {
      console.error("Promo apply failed:", e);
    }
  };

  const PROMO_STYLE: Record<string, string> = {
    top: "bg-amber-500 text-white",
    highlight: "bg-violet-500 text-white",
  };
  const PROMO_LABEL: Record<string, string> = {
    top: "ТОП",
    highlight: "Выделение",
  };
  const promoClasses = (promo: string | null) => {
    if (!promo) return "";
    return promo === "top" ? "ring-2 ring-amber-500/50" : "ring-2 ring-violet-500/50";
  };

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> На главную
        </button>

        <h1 className="font-display text-3xl mb-8">Кабинет организатора</h1>

        <div className="flex gap-1 border-b mb-8 overflow-x-auto">
          {([
            { id: "listings", label: "Мои объявления", icon: Building2 },
            { id: "bookings", label: "Входящие брони", icon: Calendar, count: incoming.length },
            { id: "profile", label: "Профиль", icon: Avatar },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />{t.label}
              {"count" in t && t.count > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">{t.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* LISTINGS */}
        {tab === "listings" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">{allListings.length} объявления</p>
              <Button className="gap-2" onClick={() => router.push("/dashboard/host/create")}>
                <Plus className="w-4 h-4" /> Подать объявление
              </Button>
            </div>
            {allListings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">У вас пока нет объявлений</p>
                <p className="text-sm mb-4">Создайте первое объявление и начните принимать гостей</p>
                <Button onClick={() => router.push("/dashboard/host/create")}>Подать объявление</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allListings.map((l) => {
                  const hasImage = !!(l.coverImage || (l.images && l.images.length > 0));
                  const typeBg = l.type === "property" ? "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]"
                    : l.type === "tour" ? "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]"
                    : l.type === "fishing" ? "from-[#70A8B0] via-[#388890] to-[#186068]"
                    : "from-[#C8C0B8] via-[#A09888] to-[#686050]";
                  const typeIcon = l.type === "property" ? "🏠" : l.type === "tour" ? "🎒" : l.type === "fishing" ? "🎣" : "🎿";
                  return (
                  <div key={l.id} className={cn(
                    "group overflow-hidden bg-card border rounded-lg transition-all hover:-translate-y-1 hover:shadow-md",
                    !l.active && "opacity-60",
                    l.promo === "highlight" && "ring-2 ring-violet-500/50",
                    l.promo === "top" && "ring-2 ring-amber-500/50"
                  )}>
                    <Link href={`/listings/${l.id}`} className="block">
                      <div className={cn("aspect-[4/3] relative overflow-hidden", !hasImage && "bg-gradient-to-br " + typeBg)}>
                        {hasImage ? (
                          <img src={l.coverImage || l.images![0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-5xl">{typeIcon}</span>
                          </div>
                        )}
                        <Badge variant="secondary" className="absolute top-3 left-3 bg-white/90 text-foreground border font-mono text-[11px]">
                          {labelFromType(l.type)}
                        </Badge>
                        {l.promo && (
                          <Badge className={cn("absolute top-3 right-3 font-mono text-[11px]", PROMO_STYLE[l.promo] || "bg-amber-500 text-white")}>
                            {PROMO_LABEL[l.promo] || l.promo}
                          </Badge>
                        )}
                        {!l.verified && (
                          <Badge className="absolute bottom-3 left-3 bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px]">На модерации</Badge>
                        )}
                      </div>
                    </Link>
                    <div className="p-4">
                      <Link href={`/listings/${l.id}`} className="hover:text-accent transition-colors">
                        <p className="text-xs uppercase tracking-widest text-accent font-medium mb-0.5"><MapPin className="w-3 h-3 inline mr-0.5" />{l.location}</p>
                        <h3 className="font-display text-base leading-tight mb-2 line-clamp-1">{l.title}</h3>
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="font-semibold text-foreground">{formatPrice(l.price || 0)}</span>
                        <span>{priceUnit(l.type)}</span>
                        {l.rating != null && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber fill-amber" />{Number(l.rating).toFixed(1)}</span>}
                        <span>{l.views} 👁</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap pt-2 border-t">
                        <Button variant="ghost" size="sm"
                          className={cn("gap-1 text-xs h-7", l.active ? "text-success" : "text-muted")}
                          onClick={(e) => { e.preventDefault(); store.toggleListingActive(l.id); }}>
                          <ToggleLeft className="w-4 h-4" />{l.active ? "Активно" : "Снято"}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                          onClick={(e) => { e.preventDefault(); router.push(`/dashboard/host/edit/${l.id}`); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                          onClick={(e) => { e.preventDefault(); setPromoListing({ id: l.id, title: l.title, promo: l.promo as PromoType | null }); }}>
                          <Megaphone className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 ml-auto"
                          onClick={(e) => { e.preventDefault(); if (confirm(`Удалить объявление «${l.title}»?`)) store.removeListing(l.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* INCOMING BOOKINGS */}
        {tab === "bookings" && (
          <div className="space-y-3">
            {incoming.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Входящих броней пока нет</p>
                <p className="text-sm">Когда гости забронируют ваши объявления, они появятся здесь</p>
              </div>
            ) : (
              incoming.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-5">
                  <div>
                    <h3 className="font-display text-lg">{b.listingTitle}</h3>
                    <p className="text-sm text-muted-foreground">Гость: {b.guestName} · {b.guests} чел.</p>
                    <p className="text-xs text-muted font-mono mt-1 tracking-wide">{formatDates(b.checkIn, b.checkOut, b.listingType)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Бронь #{b.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-display text-xl">{b.totalPrice.toLocaleString("ru-RU")} ₽</span>
                    {b.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="bg-success hover:bg-success/90" onClick={() => handleBookingAction(b.id, "confirm")}>
                          <CheckCircle className="w-4 h-4 mr-1" />Подтвердить
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBookingAction(b.id, "reject")}>
                          <XCircle className="w-4 h-4 mr-1" />Отклонить
                        </Button>
                      </div>
                    ) : (
                      <Badge className={cn("text-xs font-semibold", STATUS_BADGE[b.status].class)}>
                        {STATUS_BADGE[b.status].label}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* HOST PROFILE */}
        {tab === "profile" && (
          <div className="max-w-md">
            <div className="flex items-center gap-5 mb-8">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-accent text-accent-fg text-2xl">{store.user.name[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-display text-xl">{store.user.name}</h3>
                <p className="text-sm text-muted-foreground">Организатор · {store.user.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Имя</Label><Input value={profileName} onChange={(e) => setProfileName(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Email
                  <span className="text-[10px] text-muted-foreground font-normal">изменить нельзя</span>
                </Label>
                <Input value={profileEmail} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Телефон
                  <span className="text-[10px] text-muted-foreground font-normal">изменить нельзя</span>
                </Label>
                <Input value={profilePhone} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5" /> Сменить пароль</Label>
                <Input type="password" placeholder="Текущий пароль" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} />
                <Input type="password" placeholder="Новый пароль (мин. 8 символов, спецсимвол)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                <Input type="password" placeholder="Повторите новый пароль" value={newPassConfirm} onChange={(e) => setNewPassConfirm(e.target.value)} />
                {passError && <p className="text-xs text-destructive">{passError}</p>}
                {passSuccess && <p className="text-xs text-success">Пароль успешно изменён</p>}
                <Button variant="outline" size="sm" onClick={handleChangePassword} disabled={!currentPass || !newPass || !newPassConfirm}>
                  Обновить пароль
                </Button>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2"><Label>Локация</Label>
                <Select value={profileLocation} onValueChange={(v) => setProfileLocation(v ?? "Южно-Сахалинск")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Южно-Сахалинск", "Корсаков", "Холмск", "Невельск", "Курильск", "Анива"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>О себе</Label><Textarea placeholder="Расскажите о себе..." value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={3} /></div>
              <Button
                onClick={() => {
                  store.setUser({ ...store.user!, name: profileName, email: profileEmail, phone: profilePhone });
                  setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000);
                }}
                disabled={!profileName.trim()}
              >{profileSaved ? <><CheckCircle className="w-4 h-4 mr-1" /> Сохранено</> : "Сохранить"}</Button>
            </div>
          </div>
        )}

        {promoListing && (
          <PromoteModal
            listingId={promoListing.id} listingTitle={promoListing.title}
            open={!!promoListing} onOpenChange={(v) => { if (!v) setPromoListing(null); }}
            onApply={handlePromoApply} currentPromo={promoListing.promo}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
