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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BarChart3, Bell, Building2, Calendar, Camera, CheckCircle, Heart, ImageIcon, Key,
  Lock, MapPin, Megaphone, Pencil, Plus, Settings, ShoppingBag, Star,
  ToggleLeft, Trash2, User, XCircle, Briefcase, Phone, Eye, TrendingUp, ShieldCheck,
} from "lucide-react";

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-yellow-100 text-yellow-800", label: "Ожидает" },
  confirmed: { class: "bg-green-100 text-green-800", label: "Подтверждено" },
  completed: { class: "bg-blue-100 text-blue-800", label: "Завершено" },
  cancelled: { class: "bg-red-100 text-red-800", label: "Отменено" },
  rejected: { class: "bg-red-100 text-red-800", label: "Отклонено" },
};

type PromoType = "top" | "urgent" | "highlight";

const PROMO_STYLE: Record<string, string> = {
  top: "bg-amber-500 text-white",
  highlight: "bg-violet-500 text-white",
};
const PROMO_LABEL: Record<string, string> = {
  top: "ТОП",
  highlight: "Выделение",
};

export default function UnifiedDashboard() {
  const store = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"buyer" | "seller" | "profile">("buyer");
  const [buyerSubTab, setBuyerSubTab] = useState<"bookings" | "favorites">("bookings");
  const [sellerSubTab, setSellerSubTab] = useState<"listings" | "incoming" | "promotions">("listings");

  // Profile
  const [profileName, setProfileName] = useState(store.user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(store.user?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(store.user?.phone ?? "");
  const [profileLocation, setProfileLocation] = useState("Южно-Сахалинск");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [hostStats, setHostStats] = useState<{total_views:number;total_contacts:number;total_bookings:number;active_listings:number}>({total_views:0,total_contacts:0,total_bookings:0,active_listings:0});
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [selectedStats, setSelectedStats] = useState<{date:string;views:number;contacts:number;bookings:number}[]>([]);
  const [myPromotions, setMyPromotions] = useState<any[]>([]);

  useEffect(() => {
    if (store.user) {
      setProfileName(store.user.name);
      setProfileEmail(store.user.email);
      setProfilePhone(store.user.phone);
      loadStats();
    }
  }, [store.user, tab]);

  // Refresh user data from DB when profile tab opens (no password needed here — just looking up profile)
  useEffect(() => {
    if (tab === "profile" && store.user) {
      import("@/lib/api").then(({ apiGetAllProfiles }) => {
        apiGetAllProfiles().then((profiles: any[]) => {
          if (Array.isArray(profiles)) {
            const u = profiles.find((p: any) => p.id === store.user!.id);
            if (u) {
              setProfileName(u.name || "");
              setProfileEmail(u.email || "");
              setProfilePhone(u.phone || "");
              setProfileLocation(u.location_tag || "Южно-Сахалинск");
              setProfileBio(u.bio || "");
              store.setUser({ ...store.user!, name: u.name, email: u.email, phone: u.phone });
            }
          }
        }).catch(() => {});
      });
    }
  }, [tab]); // eslint-disable-line

  // Load my promotions when seller promotion tab selected
  useEffect(() => {
    if (tab === "seller" && sellerSubTab === "promotions" && store.user) {
      import("@/lib/api").then(({ apiGetMyPromotions }) => {
        apiGetMyPromotions(store.user!.id).then((promos: any[]) => {
          setMyPromotions(Array.isArray(promos) ? promos : []);
        }).catch(() => setMyPromotions([]));
      });
    }
  }, [tab, sellerSubTab]); // eslint-disable-line

  // Password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);

  // Phone verification in profile
  const [profileVerifyStep, setProfileVerifyStep] = useState<"none" | "show-code" | "enter-code">("none");
  const [profileVerifyCode, setProfileVerifyCode] = useState("");
  const [profileVerifyInput, setProfileVerifyInput] = useState("");
  const [profileVerifyError, setProfileVerifyError] = useState("");
  const [profileVerifySuccess, setProfileVerifySuccess] = useState(false);

  // Host: edit & promote
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [promoListing, setPromoListing] = useState<{ id: string; title: string; promo: PromoType | null } | null>(null);

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

  // Phone verification handlers
  const handleProfileGenerateCode = async () => {
    if (!store.user) return;
    setProfileVerifyError("");
    try {
      const code = await store.generateVerificationCode(store.user.email);
      if (code) {
        setProfileVerifyCode(code);
        setProfileVerifyStep("show-code");
      } else {
        setProfileVerifyError("Не удалось сгенерировать код. Попробуйте позже.");
      }
    } catch {
      setProfileVerifyError("Ошибка генерации кода.");
    }
  };

  const handleProfileVerifyCode = async () => {
    if (!store.user) return;
    if (profileVerifyInput.length !== 6) {
      setProfileVerifyError("Введите 6-значный код");
      return;
    }
    setProfileVerifyError("");
    try {
      const ok = await store.verifyPhone(store.user.email, profileVerifyInput);
      if (ok) {
        setProfileVerifySuccess(true);
        setTimeout(() => {
          setProfileVerifyStep("none");
          setProfileVerifyCode("");
          setProfileVerifyInput("");
          setProfileVerifySuccess(false);
        }, 2000);
      } else {
        setProfileVerifyError("Неверный код. Попробуйте ещё раз.");
      }
    } catch {
      setProfileVerifyError("Ошибка проверки.");
    }
  };

  const handleEditSave = () => {
    if (!editId || !editTitle.trim()) return;
    const listing = allListings.find((l) => l.id === editId);
    if (!listing) return;
    const changes: Record<string, string> = {};
    if (editTitle.trim() !== listing.title) changes.title = editTitle.trim();
    if (editPrice !== String(listing.price || "")) changes.price = editPrice;
    if (editLocation !== listing.location) changes.location = editLocation;
    if (editDescription.trim()) changes.description = editDescription.trim();
    if (Object.keys(changes).length === 0) { setEditId(null); return; }
    store.requestListingEdit({
      listingId: editId, listingTitle: listing.title,
      hostId: store.user!.id, hostName: store.user!.name, changes,
    });
    setEditSubmitted(true);
    setTimeout(() => { setEditId(null); setEditSubmitted(false); }, 1500);
  };

  const handleBookingAction = (bid: string, action: "confirm" | "reject") =>
    store.updateBookingStatus(bid, action === "confirm" ? "confirmed" : "rejected");

  const promoClasses = (promo: string | null) => {
    if (!promo) return "";
    return promo === "top" ? "ring-2 ring-amber-500/50" : "ring-2 ring-violet-500/50";
  };

  const pendingForListing = (listingId: string) => store.pendingEdits.some((e) => e.listingId === listingId);

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

  useEffect(() => { if (!store.user) router.push("/"); }, [store.user, router]);

  if (!store.user) return null;

  const allListings = store.myListings.filter((l) => l.hostId === store.user!.id || store.user!.role === "admin");
  const myBookings = store.bookings
    .filter((b) => b.guestId === store.user!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const incoming = store.bookings
    .filter((b) => b.hostName === store.user!.name || store.user!.role === "admin")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const loadStats = async () => {
    if (!store.user) return;
    const { apiGetHostStats } = await import("@/lib/api");
    const stats = await apiGetHostStats(store.user.id).catch(() => null);
    if (stats) setHostStats(stats);
  };

  const loadListingStats = async (listingId: string) => {
    if (!store.user || !listingId) return;
    const { apiGetHostListingStats } = await import("@/lib/api");
    const s = await apiGetHostListingStats(store.user.id, listingId).catch(() => []);
    setSelectedStats(s);
    setSelectedListingId(listingId);
    setStatsOpen(true);
  };

  const mainTabs = [
    { id: "buyer", label: "Покупки", icon: ShoppingBag, count: myBookings.length },
    { id: "seller", label: "Объявления", icon: Building2, count: allListings.length },
    { id: "profile", label: "Профиль", icon: Settings },
  ] as const;

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> На главную
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className="relative inline-block">
            <Avatar className="w-14 h-14">
              {(store.user as any).avatar_url || store.user.avatar ? <img src={(store.user as any).avatar_url || store.user.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : <AvatarFallback className="bg-accent text-accent-fg text-xl">{store.user.name[0].toUpperCase()}</AvatarFallback>}
            </Avatar>
            <label className="absolute bottom-0 right-0 w-7 h-7 bg-accent text-accent-fg rounded-full flex items-center justify-center cursor-pointer hover:bg-accent/90 transition-colors shadow">
              <Camera className="w-3.5 h-3.5" />
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file || !store.user) return;
                if (file.size > 2 * 1024 * 1024) { alert("Фото не более 2 МБ"); return; }
                const fd = new FormData(); fd.append("file", file);
                try {
                  const r = await fetch("/api/upload", { method: "POST", body: fd });
                  const j = await r.json();
                  if (j.ok) {
                    const url = j.data.url;
                    store.setUser({ ...store.user, avatar: url });
                    const { apiUpdateProfile } = await import("@/lib/api");
                    await apiUpdateProfile(store.user!.id, { avatar_url: url }).catch(() => {});
                  }
                } catch { /* local */ }
              }} />
            </label>
          </div>
          <div>
            <h1 className="font-display text-3xl">{store.user.name}</h1>
            <p className="text-sm text-muted-foreground">{store.user.email}</p>
          </div>
        </div>
        <div className="flex gap-1 border-b mb-6 overflow-x-auto">
          {mainTabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="w-4 h-4" />{t.label}
              {"count" in t && t.count > 0 && <Badge variant="secondary" className="text-xs ml-1">{t.count}</Badge>}
            </button>
          ))}
        </div>

        {/* BUYER */}
        {tab === "buyer" && (
          <div>
            <div className="flex gap-2 mb-6">
              {(["bookings","favorites"] as const).map((st) => (
                <button key={st} onClick={() => setBuyerSubTab(st)}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    buyerSubTab === st ? "bg-accent text-accent-fg" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {st === "bookings" ? "Мои бронирования" : "Избранное"}
                </button>
              ))}
            </div>
            {buyerSubTab === "bookings" && (
              <div className="space-y-3">
                {myBookings.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg">У вас пока нет бронирований</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/catalog")}>В каталог</Button>
                  </div>
                ) : (
                  myBookings.map((b) => (
                    <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-5">
                      <div>
                        <h3 className="font-display text-lg">{b.listingTitle}</h3>
                        <p className="text-sm text-muted-foreground">{b.location} · {b.hostName}</p>
                        <p className="text-xs text-muted font-mono mt-1">{formatDates(b.checkIn, b.checkOut, b.listingType)} · {b.guests} чел.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn("text-xs font-semibold", STATUS_BADGE[b.status].class)}>{STATUS_BADGE[b.status].label}</Badge>
                        <span className="font-display text-xl">{b.totalPrice.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {buyerSubTab === "favorites" && (
              <div className="text-center py-16 text-muted-foreground">
                <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Избранное пока пусто</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push("/catalog")}>В каталог</Button>
              </div>
            )}
          </div>
        )}

        {/* SELLER */}
        {tab === "seller" && (
          <div>
            <div className="flex gap-2 mb-6">
              {(["listings","incoming","promotions"] as const).map((st) => (
                <button key={st} onClick={() => setSellerSubTab(st)}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                    sellerSubTab === st ? "bg-accent text-accent-fg" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {st === "listings" ? "Мои объявления" : st === "incoming" ? "Входящие брони" : "Продвижения"}
                  {(st === "listings" ? allListings.length : st === "incoming" ? incoming.length : myPromotions.length) > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20">
                      {st === "listings" ? allListings.length : st === "incoming" ? incoming.length : myPromotions.length}
                    </span>
                  )}
                </button>
              ))}
              <div className="flex-1" />
              <Button size="sm" className="gap-1.5" onClick={() => router.push("/dashboard/create")}>
                <Plus className="w-4 h-4" /> Подать объявление
              </Button>
            </div>

            {sellerSubTab === "listings" && (
              <>
                {/* ── Analytics Card ── */}
                <div className="bg-card border rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-accent" /> Статистика за 7 дней
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{hostStats.total_views}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Просмотры</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{hostStats.total_contacts}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Контакты</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{hostStats.total_bookings}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Бронирования</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{hostStats.active_listings}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Объявлений</div>
                    </div>
                  </div>
                </div>

                {/* ── Chart Modal ── */}
                {statsOpen && selectedStats.length > 0 && (
                  <div className="bg-card border rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-accent" /> Просмотры по дням
                      </h3>
                      <button onClick={() => { setStatsOpen(false); setSelectedListingId(""); }} className="text-muted-foreground hover:text-foreground text-sm">
                        ✕
                      </button>
                    </div>
                    <div className="flex items-end gap-2 h-32 px-1">
                      {selectedStats.map((d) => {
                        const maxV = Math.max(...selectedStats.map(x => x.views), 1);
                        const h = Math.max(4, (d.views / maxV) * 100);
                        const day = new Date(d.date).toLocaleDateString("ru-RU", { weekday: "short" });
                        const date = new Date(d.date).getDate();
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className="text-[10px] font-semibold text-accent mb-0.5">{d.views}</span>
                            <div className="w-full bg-accent rounded-t-md transition-all" style={{ height: `${h}%` }} />
                            <span className="text-[9px] text-muted-foreground mt-1 text-center leading-tight">{day}<br/>{date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {allListings.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg">У вас пока нет объявлений</p>
                    <Button onClick={() => router.push("/dashboard/create")}>Подать объявление</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allListings.map((l) => {
                      const hasImage = !!(l.coverImage || (l.images && l.images.length > 0));
                      const typeBg = l.type === "property" ? "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]"
                        : l.type === "tour" ? "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]"
                        : l.type === "fishing" ? "from-[#70A8B0] via-[#388890] to-[#186068]"
                        : l.type === "car_rental" ? "from-[#B8C8D0] via-[#688898] to-[#385060]"
                        : "from-[#C8C0B8] via-[#A09888] to-[#686050]";
                      const typeIcon = l.type === "property" ? "🏠" : l.type === "tour" ? "🎒" : l.type === "fishing" ? "🎣" : l.type === "car_rental" ? "🚗" : "🎿";
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
                              title={l.active ? "Снять с публикации" : "Опубликовать"}
                              onClick={(e) => { e.preventDefault(); store.toggleListingActive(l.id); }}>
                              <ToggleLeft className="w-4 h-4" />{l.active ? "Активно" : "Снято"}
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" title="Редактировать"
                              onClick={(e) => { e.preventDefault(); setEditId(l.id); setEditTitle(l.title); setEditPrice(String(l.price || "")); setEditLocation(l.location); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" title="Продвинуть"
                              onClick={(e) => { e.preventDefault(); setPromoListing({ id: l.id, title: l.title, promo: (l.promo as PromoType) || null }); }}>
                              <Megaphone className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 ml-auto" title="Удалить"
                              onClick={(e) => { e.preventDefault(); if (confirm(`Удалить «${l.title}»?`)) store.removeListing(l.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-accent" title="Статистика просмотров"
                              onClick={(e) => { e.preventDefault(); loadListingStats(l.id); }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </>
            )}

            {sellerSubTab === "incoming" && (
              <div className="space-y-3">
                {incoming.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg">Входящих броней пока нет</p>
                  </div>
                ) : (
                  incoming.map((b) => (
                    <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-5">
                      <div>
                        <h3 className="font-display text-lg">{b.listingTitle}</h3>
                        <p className="text-sm text-muted-foreground">Гость: {b.guestName} · {b.guests} чел.</p>
                        <p className="text-xs text-muted font-mono mt-1">{formatDates(b.checkIn, b.checkOut, b.listingType)}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-display text-xl">{b.totalPrice.toLocaleString("ru-RU")} ₽</span>
                        {b.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-success hover:bg-success/90" onClick={() => handleBookingAction(b.id, "confirm")}>
                              <CheckCircle className="w-4 h-4 mr-1" />Подтвердить
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleBookingAction(b.id, "reject")}>
                              <XCircle className="w-4 h-4 mr-1" />Отклонить
                            </Button>
                          </div>
                        ) : (
                          <Badge className={cn("text-xs font-semibold", STATUS_BADGE[b.status].class)}>{STATUS_BADGE[b.status].label}</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {sellerSubTab === "promotions" && (
              <div>
                {/* Total spent summary */}
                <div className="bg-card border rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-accent" /> Мои продвижения
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{myPromotions.length}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Всего кампаний</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-success">{myPromotions.filter((p:any) => p.status === "active").length}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Активны</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{myPromotions.reduce((s:number,p:any)=>s+(p.impressions||0),0).toLocaleString("ru-RU")}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Показы</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-display font-bold text-accent">{myPromotions.reduce((s:number,p:any)=>s+(p.price||0)*(p.status==="paid"||p.status==="active"?1:0),0).toLocaleString("ru-RU")} ₽</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Потрачено</div>
                    </div>
                  </div>
                </div>

                {myPromotions.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg">У вас пока нет продвижений</p>
                    <p className="text-sm mt-1">Продвиньте объявление, чтобы оно чаще показывалось гостям</p>
                    <Button variant="outline" className="mt-4" onClick={() => setSellerSubTab("listings")}>
                      Перейти к объявлениям
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myPromotions.map((p: any) => {
                      const isActive = p.status === "active";
                      const promoTypeLabels: Record<string,string> = { top: "ТОП", highlight: "Выделение", urgent: "Срочное" };
                      const promoTypeColors: Record<string,string> = { top: "bg-amber-100 text-amber-800", highlight: "bg-violet-100 text-violet-800", urgent: "bg-red-100 text-red-800" };
                      const startDate = p.startedAt ? new Date(p.startedAt).toLocaleDateString("ru-RU") : "—";
                      const endDate = p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("ru-RU") : "—";
                      return (
                        <div key={p.id} className={cn(
                          "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-5",
                          isActive && "border-green-200"
                        )}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-display text-lg">{p.listingTitle}</h3>
                              <Badge className={cn("text-xs font-semibold", promoTypeColors[p.promoType] || "bg-gray-100 text-gray-800")}>
                                {promoTypeLabels[p.promoType] || p.promoType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {startDate} – {endDate} · {p.durationDays} дн.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Показы: {p.impressions ?? 0}</span>
                              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Клики: {p.clicks ?? 0}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-display text-lg">{p.price?.toLocaleString("ru-RU")} ₽</span>
                            <Badge className={cn(
                              "text-xs font-semibold",
                              isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                            )}>
                              {isActive ? "Активен" : p.status === "expired" ? "Истёк" : p.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="grid lg:grid-cols-2 gap-10">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Имя</Label><Input value={profileName} onChange={(e) => setProfileName(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Email <span className="text-[10px] text-muted-foreground font-normal">изменить нельзя</span></Label>
                <Input value={profileEmail} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Телефон <span className="text-[10px] text-muted-foreground font-normal">изменить нельзя</span></Label>
                <Input value={profilePhone} disabled className="opacity-60 cursor-not-allowed" />
                {store.user.phoneVerified ? (
                  <p className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Телефон подтверждён</p>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-800">Телефон не подтверждён. Подтвердите для доступа ко всем функциям.</p>
                    {profileVerifyStep === "none" ? (
                      <Button size="sm" variant="outline" onClick={handleProfileGenerateCode} className="gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Подтвердить телефон
                      </Button>
                    ) : profileVerifySuccess ? (
                      <p className="text-sm text-success flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Телефон подтверждён ✓</p>
                    ) : profileVerifyStep === "show-code" ? (
                      <div className="space-y-2">
                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground">Ваш код подтверждения:</p>
                          <div className="font-mono text-2xl font-bold tracking-[0.2em] text-accent mt-1">
                            {profileVerifyCode}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => setProfileVerifyStep("enter-code")}>
                          Ввести код
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Код:</p>
                          <div className="font-mono text-xl font-bold tracking-[0.2em] text-accent">
                            {profileVerifyCode}
                          </div>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="123456"
                          value={profileVerifyInput}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setProfileVerifyInput(v);
                            setProfileVerifyError("");
                          }}
                          className="text-center font-mono tracking-[0.3em]"
                        />
                        {profileVerifyError && <p className="text-xs text-destructive">{profileVerifyError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={handleProfileVerifyCode} disabled={profileVerifyInput.length !== 6}>
                            Подтвердить
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setProfileVerifyStep("show-code")}>Назад</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2"><Label>Локация</Label>
                <Select value={profileLocation} onValueChange={(v) => setProfileLocation(v ?? "Южно-Сахалинск")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Южно-Сахалинск", "Корсаков", "Холмск", "Невельск", "Курильск", "Анива"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>О себе</Label><Textarea placeholder="Расскажите о себе..." value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={4} /></div>
              <Button
                onClick={() => { store.setUser({ ...store.user!, name: profileName, email: profileEmail, phone: profilePhone }); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); }}
                disabled={!profileName.trim()} className="w-full">
                {profileSaved ? <><CheckCircle className="w-4 h-4 mr-1" /> Сохранено</> : "Сохранить изменения"}
              </Button>
            </div>
            <div className="space-y-6">
              <div className="bg-card border rounded-lg p-5 space-y-4">
                <h3 className="font-display text-lg flex items-center gap-2"><Bell className="w-4 h-4" /> Уведомления</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotif}
                    onChange={async (e) => {
                      const v = e.target.checked;
                      setEmailNotif(v);
                      if (store.user) {
                        const { apiSetEmailNotificationPref } = await import("@/lib/api");
                        await apiSetEmailNotificationPref(store.user.id, v).catch(() => setEmailNotif(!v));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-sm font-medium">Email-уведомления</p>
                    <p className="text-xs text-muted-foreground">Получать письма о новых сообщениях и бронированиях на почту</p>
                  </div>
                </label>
              </div>
              <div className="bg-card border rounded-lg p-5 space-y-3">
                <h3 className="font-display text-lg flex items-center gap-2"><Key className="w-4 h-4" /> Сменить пароль</h3>
                <Input type="password" placeholder="Текущий пароль" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} />
                <Input type="password" placeholder="Новый пароль (мин. 8 символов, спецсимвол)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                <Input type="password" placeholder="Повторите новый пароль" value={newPassConfirm} onChange={(e) => setNewPassConfirm(e.target.value)} />
                {passError && <p className="text-xs text-destructive">{passError}</p>}
                {passSuccess && <p className="text-xs text-success">Пароль успешно изменён</p>}
                <Button variant="outline" size="sm" onClick={handleChangePassword} disabled={!currentPass || !newPass || !newPassConfirm}>Обновить пароль</Button>
              </div>
              <div className="bg-card border rounded-lg p-5">
                <h3 className="font-display text-lg mb-4">Активность</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="font-display text-2xl">{allListings.length}</div><div className="text-xs text-muted-foreground">Объявлений</div></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="font-display text-2xl">{myBookings.length}</div><div className="text-xs text-muted-foreground">Бронирований</div></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="font-display text-2xl">{incoming.length}</div><div className="text-xs text-muted-foreground">Входящих</div></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><div className="font-display text-2xl">{store.favorites.length}</div><div className="text-xs text-muted-foreground">В избранном</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editId} onOpenChange={(v) => { if (!v) { setEditId(null); setEditSubmitted(false); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display text-xl">Редактировать объявление</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {editSubmitted ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-success" />
                  <p className="font-display text-lg">Изменения отправлены</p>
                  <p className="text-sm text-muted-foreground">Объявление появится после проверки модератором</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    Изменения будут отправлены на модерацию. Текущая версия останется видна до одобрения.
                  </div>
                  <div className="space-y-2"><Label>Название</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Цена</Label><Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Цена в ₽" /></div>
                  <div className="space-y-2"><Label>Локация</Label>
                    <Select value={editLocation} onValueChange={(v) => setEditLocation(v ?? "")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Южно-Сахалинск","Корсаков","Холмск","Невельск","Курильск","Анива"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Описание</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Опишите объявление..." rows={4} /></div>
                </>
              )}
            </div>
            {!editSubmitted && (
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditId(null)}>Отмена</Button>
                <Button onClick={handleEditSave} disabled={!editTitle.trim()}>Отправить на модерацию</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {promoListing && (
          <PromoteModal
            listingId={promoListing.id} listingTitle={promoListing.title}
            open={!!promoListing} onOpenChange={(v) => { if (!v) setPromoListing(null); }}
            currentPromo={promoListing.promo}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
