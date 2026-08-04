"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowLeft, Calendar, CheckCircle, Heart, Key, Lock, MapPin, User, XCircle } from "lucide-react";

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-yellow-100 text-yellow-800", label: "Ожидает подтверждения" },
  confirmed: { class: "bg-green-100 text-green-800", label: "Подтверждено" },
  completed: { class: "bg-blue-100 text-blue-800", label: "Завершено" },
  cancelled: { class: "bg-red-100 text-red-800", label: "Отменено" },
  rejected: { class: "bg-red-100 text-red-800", label: "Отклонено" },
};

// Seed demo bookings if store is empty (first load)
const SEED_BOOKINGS = [
  { id: "b1", listingId: "3", listingTitle: "Джип-тур на Мыс Великан", listingType: "tour", location: "Корсаков", guestId: "traveler-1", guestName: "Александр", hostName: "Сергей К.", checkIn: "2026-08-12", checkOut: "2026-08-12", guests: 2, totalPrice: 24000, pricePerUnit: 12000, unit: "₽ / чел.", status: "confirmed" as const, createdAt: "2026-07-20T10:00:00Z" },
  { id: "b2", listingId: "1", listingTitle: "Квартира у СТК «Горный Воздух»", listingType: "property", location: "Южно-Сахалинск", guestId: "traveler-1", guestName: "Александр", hostName: "Елена М.", checkIn: "2027-02-03", checkOut: "2027-02-07", guests: 2, totalPrice: 18000, pricePerUnit: 4500, unit: "₽ / ночь", status: "pending" as const, createdAt: "2026-07-25T14:00:00Z" },
  { id: "b3", listingId: "8", listingTitle: "Речная рыбалка на горбушу", listingType: "fishing", location: "Анива", guestId: "traveler-1", guestName: "Александр", hostName: "Дмитрий В.", checkIn: "2026-08-20", checkOut: "2026-08-20", guests: 3, totalPrice: 30000, pricePerUnit: 10000, unit: "₽ / чел.", status: "completed" as const, createdAt: "2026-07-10T08:00:00Z" },
  { id: "b4", listingId: "10", listingTitle: "Морской выход на Маяк Анива", listingType: "tour", location: "Корсаков", guestId: "traveler-1", guestName: "Александр", hostName: "Алексей Н.", checkIn: "2026-09-05", checkOut: "2026-09-05", guests: 4, totalPrice: 60000, pricePerUnit: 15000, unit: "₽ / чел.", status: "cancelled" as const, createdAt: "2026-07-15T12:00:00Z" },
];

const FAVORITES = [
  { id: "5", title: "Тур на Итуруп: вулканы и лагуны", location: "Курильск", price: 85000, unit: "₽ / чел.", rating: 4.9, type: "tour" },
  { id: "1", title: "Квартира у СТК «Горный Воздух»", location: "Южно-Сахалинск", price: 4500, unit: "₽ / ночь", rating: 4.9, type: "property" },
  { id: "9", title: "Морская рыбалка на кунджу", location: "Невельск", price: 8000, unit: "₽ / чел.", rating: 4.9, type: "fishing" },
  { id: "10", title: "Морской выход на Маяк Анива", location: "Корсаков", price: 15000, unit: "₽ / чел.", rating: 4.9, type: "tour" },
];

export default function TravelerDashboard() {
  const store = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"bookings" | "favorites" | "profile">("bookings");

  // Profile form state
  const [profileName, setProfileName] = useState(store.user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(store.user?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(store.user?.phone ?? "");
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
    if (!PASSWORD_REGEX.test(newPass)) { setPassError("Пароль должен содержать хотя бы один спецсимвол (!@#$%^&* и т.д.)"); return; }
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

  useEffect(() => {
    if (!store.user) router.push("/");
    // Seed demo bookings once
    if (store.user && store.bookings.length === 0) {
      SEED_BOOKINGS.forEach((b) => {
        if (!store.bookings.find((x) => x.id === b.id)) {
          useStore.setState((s) => ({ bookings: [...s.bookings, b] }));
        }
      });
    }
  }, [store.user, router]);

  const myBookings = store.user
    ? store.bookings.filter((b) => b.guestId === store.user!.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  if (!store.user) return null;

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

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> На главную
        </button>

        <h1 className="font-display text-3xl mb-8">Мой кабинет</h1>

        <div className="flex gap-1 border-b mb-8 overflow-x-auto">
          {([
            { id: "bookings", label: "Мои бронирования", icon: Calendar },
            { id: "favorites", label: "Избранное", icon: Heart },
            { id: "profile", label: "Профиль", icon: User },
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
            </button>
          ))}
        </div>

        {/* BOOKINGS */}
        {tab === "bookings" && (
          <div className="space-y-3">
            {myBookings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">У вас пока нет бронирований</p>
                <p className="text-sm">Забронируйте жильё, тур или рыбалку из каталога</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push("/catalog")}>В каталог</Button>
              </div>
            ) : (
              myBookings.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-5">
                  <div>
                    <h3 className="font-display text-lg">{b.listingTitle}</h3>
                    <p className="text-sm text-muted-foreground">{b.location} · Организатор: {b.hostName}</p>
                    <p className="text-xs text-muted font-mono mt-1 tracking-wide">{formatDates(b.checkIn, b.checkOut, b.listingType)} · {b.guests} чел.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Бронь #{b.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={cn("text-xs font-semibold", STATUS_BADGE[b.status].class)}>
                      {STATUS_BADGE[b.status].label}
                    </Badge>
                    <span className="font-display text-xl">{b.totalPrice.toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* FAVORITES */}
        {tab === "favorites" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FAVORITES.map((f) => (
              <div
                key={f.id}
                className="bg-card border rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all"
                onClick={() => router.push(`/listings/${f.id}`)}
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-300 flex items-end p-3">
                  <Badge variant="secondary" className="bg-white/90 text-foreground border text-xs">
                    {f.type === "property" ? "Жильё" : f.type === "fishing" ? "Рыбалка" : "Тур"}
                  </Badge>
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-widest text-accent font-medium">{f.location}</p>
                  <h3 className="font-display text-lg leading-tight mt-0.5 mb-2">{f.title}</h3>
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="font-display text-lg">{f.price.toLocaleString("ru-RU")} <small className="text-sm text-muted font-sans">{f.unit}</small></span>
                    <span className="text-sm text-muted-foreground">{f.rating} ★</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="max-w-md">
            <div className="flex items-center gap-5 mb-8">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-accent text-accent-fg text-2xl">{store.user.name[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-display text-xl">{store.user.name}</h3>
                <p className="text-sm text-muted-foreground">Путешественник · {store.user.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Имя</Label><Input value={profileName} onChange={(e) => setProfileName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Телефон
                  <span className="text-[10px] text-muted-foreground font-normal">изменить нельзя</span>
                </Label>
                <Input value={profilePhone} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" />
                  Сменить пароль
                </Label>
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
              <Button
                onClick={() => {
                  store.setUser({ ...store.user!, name: profileName, email: profileEmail, phone: profilePhone });
                  setProfileSaved(true);
                  setTimeout(() => setProfileSaved(false), 2000);
                }}
                disabled={!profileName.trim()}
              >
                {profileSaved ? <><CheckCircle className="w-4 h-4 mr-1" /> Сохранено</> : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
