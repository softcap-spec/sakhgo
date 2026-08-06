"use client";

import { useState, useEffect, useRef } from "react";
import { useStore, Banner } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { apiUpdateProfile, apiUpdateUserRole } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Shield, Users, Store, Banknote, Wrench, CheckCircle, XCircle,
  Eye, Ban, UserCog, TrendingUp, Clock, Search, Filter, DollarSign,
  FileText, Save, Bold, Italic, Heading, List, ListOrdered,
  Pencil, Tag, Plus, Trash2, Megaphone, Image, MessageSquare, Rocket, LayoutDashboard, BarChart3, UserPlus
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { ReviewsTab } from "@/components/reviews-tab";
import { PromotionsTab } from "@/components/promotions-tab";

// ── Mock data ──
const PENDING_LISTINGS = [
  { id: "p1", title: "Квартира-студия в центре", host: "Марина С.", type: "property", location: "Южно-Сахалинск", price: 3500, unit: "₽ / ночь", submitted: "28.07.2026 14:23" },
  { id: "p2", title: "Тур на озеро Буссе", host: "Виктор П.", type: "tour", location: "Корсаков", price: 5000, unit: "₽ / чел.", submitted: "28.07.2026 12:10" },
  { id: "p3", title: "Снегоходы в аренду — BRP Expedition", host: "Олег Т.", type: "rental_gear", location: "Южно-Сахалинск", price: 8000, unit: "₽ / сутки", submitted: "27.07.2026 18:45" },
  { id: "p4", title: "Дом у моря в Стародубском", host: "Анна К.", type: "property", location: "Долинск", price: 12000, unit: "₽ / ночь", submitted: "27.07.2026 09:30" },
];

const USERS = [
  { id: "u1", name: "Александр", email: "alex@example.com", role: "admin", verified: true, joined: "15.06.2026", listings: 0, bookings: 3 },
  { id: "u2", name: "Елена М.", email: "elena@example.com", role: "host", verified: true, joined: "20.06.2026", listings: 4, bookings: 12 },
  { id: "u3", name: "Сергей К.", email: "sergey@example.com", role: "host", verified: true, joined: "01.07.2026", listings: 2, bookings: 8 },
  { id: "u4", name: "Марина С.", email: "marina@example.com", role: "vendor", verified: false, joined: "15.07.2026", listings: 3, bookings: 1 },
  { id: "u5", name: "Игорь П.", email: "igor@example.com", role: "traveler", verified: true, joined: "10.07.2026", listings: 0, bookings: 5 },
  { id: "u6", name: "Дмитрий В.", email: "dmitry@example.com", role: "host", verified: true, joined: "05.07.2026", listings: 1, bookings: 3 },
];

const PROMO_LOG = [
  { id: "pm1", host: "Елена М.", listing: "Джип-тур на Мыс Великан", type: "top", price: 2990, date: "27.07.2026", status: "paid" },
  { id: "pm2", host: "Сергей К.", listing: "Морская рыбалка на кунджу", type: "hot", price: 990, date: "26.07.2026", status: "paid" },
  { id: "pm3", host: "Марина С.", listing: "Квартира-студия в центре", type: "highlight", price: 1490, date: "25.07.2026", status: "paid" },
  { id: "pm4", host: "Дмитрий В.", listing: "Тур на Итуруп", type: "top", price: 2990, date: "24.07.2026", status: "refunded" },
  { id: "pm5", host: "Елена М.", listing: "Квартира у Горного Воздуха", type: "highlight", price: 1490, date: "23.07.2026", status: "paid" },
];

const HELP_SECTIONS = [
  { key: "howItWorks", label: "Как это работает" },
  { key: "faq", label: "Частые вопросы" },
  { key: "cancelPolicy", label: "Политика отмены" },
  { key: "support", label: "Поддержка" },
  { key: "hostInfo", label: "Разместить объявление" },
  { key: "rules", label: "Правила площадки" },
  { key: "privacy", label: "Конфиденциальность" },
  { key: "terms", label: "Условия использования" },
];

const ADMIN_USER = { name: "Александр", email: "alex@example.com", role: "admin" };

type ContentSection = "howItWorks" | "faq" | "cancelPolicy" | "support" | "hostInfo" | "rules";

function DashboardTab({ stats }: { stats: any }) {
  const formatNum = (n?: number) => (n != null ? n.toLocaleString("ru-RU") : "—");
  const formatRub = (n?: number) => (n != null ? n.toLocaleString("ru-RU") + " ₽" : "—");

  const roleLabels: Record<string, string> = {
    admin: "Админ", host: "Хосты", traveler: "Путешественники",
    user: "Пользователи", vendor: "Продавцы", guide: "Гиды"
  };

  if (!stats) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Всего пользователей" value={formatNum(stats.totalUsers)}
          sub={stats.newUsers7d > 0 ? `+${stats.newUsers7d} за неделю` : "0 за неделю"}
          icon={Users} color="blue"
        />
        <StatCard
          label="Объявлений" value={formatNum(stats.totalListings)}
          sub={`${formatNum(stats.activeListings)} активных · ${formatNum(stats.pendingEdits)} на модерации`}
          icon={Store} color="green"
        />
        <StatCard
          label="Броней всего" value={formatNum(stats.totalBookings)}
          sub={stats.newBookings7d > 0 ? `+${stats.newBookings7d} за неделю` : "0 за неделю"}
          icon={Banknote} color="amber"
        />
        <StatCard
          label="Доход от продвижения" value={formatRub(stats.promoRevenue)}
          sub={"Оплаченные размещения"}
          icon={TrendingUp} color="red"
        />
      </div>

      {/* Weekly activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserPlus className="w-4 h-4" /> Новые пользователи за 7 дней
          </div>
          <div className="text-3xl font-bold">{formatNum(stats.newUsers7d)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Всего: {formatNum(stats.totalUsers)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Store className="w-4 h-4" /> Новые объявления за 7 дней
          </div>
          <div className="text-3xl font-bold">{formatNum(stats.newListings7d)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Всего: {formatNum(stats.totalListings)} · Активно: {formatNum(stats.activeListings)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Banknote className="w-4 h-4" /> Новые брони за 7 дней
          </div>
          <div className="text-3xl font-bold">{formatNum(stats.newBookings7d)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Всего: {formatNum(stats.totalBookings)}
          </div>
        </div>
      </div>

      {/* Role distribution */}
      {(stats.usersByRole && stats.usersByRole.length > 0) && (
        <div className="rounded-xl border bg-card p-5">
          <div className="text-sm font-medium mb-3">Пользователи по ролям</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.usersByRole.map((r: { role: string; count: number }) => (
              <div key={r.role} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">{roleLabels[r.role] || r.role}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: any; color: "blue" | "green" | "amber" | "red";
}) {
  const colors = {
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    green: "from-green-500/10 to-green-500/5 border-green-500/20",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    red: "from-red-500/10 to-red-500/5 border-red-500/20",
  };
  const icons = {
    blue: "text-blue-500", green: "text-green-500", amber: "text-amber-500", red: "text-red-500",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colors[color]} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`w-5 h-5 ${icons[color]}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

export default function AdminPage() {
  const store = useStore();
  const router = useRouter();
  const didMount = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"dashboard" | "moderation" | "reviews" | "users" | "listings" | "maintenance" | "payments" | "content" | "categories" | "banners">("dashboard");
  const [pending, setPending] = useState<typeof PENDING_LISTINGS>([]);
  const [users, setUsers] = useState<typeof USERS>([]);
  const [stats, setStats] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const USER_PAGE_SIZE = 15;

  // If user is logged in as admin, load data
  useEffect(() => {
    if (!store.user || store.user.role !== "admin") return;

    // Load admin stats
    import("@/lib/api").then(({ apiGetAdminStats }) => {
      apiGetAdminStats().then((s) => {
        if (s) setStats(s);
      }).catch(() => {});
    });
    // Load pending edits directly from DB
    import("@/lib/api").then(({ apiGetPendingEdits }) => {
      apiGetPendingEdits().then((edits: any[]) => {
        if (Array.isArray(edits)) {
          const storeEdits = edits.filter((e: any) => e.status === "pending").map((e: any) => ({
            id: e.id,
            listingId: e.listingId || e.listing_id,
            title: e.listingTitle || e.listing_title,
            host: e.hostName || e.host_name,
            type: ((e.changes as any)?.type as string) || "property",
            location: ((e.changes as any)?.location as string) || "",
            price: parseInt(String((e.changes as any)?.price || "0")) || 0,
            unit: "₽",
            submitted: e.submittedAt ? new Date(e.submittedAt).toLocaleString("ru-RU") : "—",
            changes: e.changes || {},
          }));
          setPending(storeEdits);
        }
      }).catch(() => {});
    });

    // Users: load with search + pagination
    import("@/lib/api").then(({ apiSearchProfiles }) => {
      apiSearchProfiles(userSearch, 1, USER_PAGE_SIZE).then((result: any) => {
        if (result?.items) {
          const dbUsers = result.items.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role,
            verified: p.email_verified ?? false,
            joined: p.created_at ? new Date(p.created_at).toLocaleDateString("ru-RU") : "—",
            listings: p.listings_count ?? 0,
            bookings: p.bookings_count ?? 0,
            phone: p.phone,
          }));
          setUsers(dbUsers);
          setUserTotal(result.total);
        }
      });
    });
  }, [tab]); // Reload when switching tabs

  // Update listing counts when store changes
  useEffect(() => {
    if (!store.user) return;
    const listingCounts = new Map<string, number>();
    store.myListings.forEach(l => {
      listingCounts.set(l.hostId, (listingCounts.get(l.hostId) || 0) + 1);
    });
    setUsers(prev => prev.map(u => ({
      ...u,
      listings: u.id === store.user?.id 
        ? store.myListings.length 
        : (listingCounts.get(u.id) ?? u.listings),
    })));
  }, [store.myListings, store.user]);

  // Reject dialog state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Role dialog state
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [roleValue, setRoleValue] = useState("");

  // Load category listing counts when switching to categories tab
  useEffect(() => {
    if (tab === "categories") {
      import("@/lib/api").then(({ apiGetAllListings }) => {
        apiGetAllListings().then((listings: any[]) => {
          if (Array.isArray(listings)) {
            const counts: Record<string, number> = {};
            listings.forEach((l: any) => {
              const t = l.type || "unknown";
              counts[t] = (counts[t] || 0) + 1;
            });
            setCatListingCounts(counts);
          }
        }).catch(() => {});
      });
    }
  }, [tab]);

  // Delete user dialog state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);

  // Role label mapping — prevents raw English keys from showing in SelectValue
  const ROLE_LABELS: Record<string, string> = {
    admin: "Администратор (admin)",
    host: "Организатор / Собственник",
    vendor: "Продавец (vendor)",
    traveler: "Путешественник",
    banned: "Заблокирован",
  };

  // Edit user dialog state
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserVerified, setEditUserVerified] = useState(false);

  // Content editing state
  const [contentKey, setContentKey] = useState<ContentSection>("howItWorks");
  const [contentText, setContentText] = useState("");
  const [contentSaved, setContentSaved] = useState(false);

  // Auth guard: block access entirely unless store.user.role === "admin"
  // No auto-login fallback — user must explicitly authenticate


  const loadUsers = (search?: string, page?: number) => {
    const s = search ?? userSearch;
    const p = page ?? 1;
    import("@/lib/api").then(({ apiSearchProfiles }) => {
      apiSearchProfiles(s, p, USER_PAGE_SIZE).then((result: any) => {
        if (result?.items) {
          const dbUsers = result.items.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role,
            verified: p.email_verified ?? false,
            joined: p.created_at ? new Date(p.created_at).toLocaleDateString("ru-RU") : "—",
            listings: p.listings_count ?? 0,
            bookings: p.bookings_count ?? 0,
            phone: p.phone,
          }));
          setUsers(dbUsers);
          setUserTotal(result.total);
        }
      });
    });
  };

  const handleApprove = async (id: string) => {
    const localItem = pending.find(p => p.id === id);
    if (!localItem) return;
    const listingId = (localItem as any).listingId as string;
    if (!listingId) return;
    try {
      const { apiApproveEdit, apiApproveListing } = await import("@/lib/api");
      await apiApproveEdit(id, listingId, (localItem as any).changes || {});
      await apiApproveListing(listingId);
    } catch (e) {
      console.error("Approve failed:", e);
    }
    setPending((p) => p.filter((l) => l.id !== id));
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      const { apiRejectEdit } = await import("@/lib/api");
      await apiRejectEdit(rejectId);
    } catch (e) {
      console.error("Reject failed:", e);
    }
    setPending((p) => p.filter((l) => l.id !== rejectId));
    setRejectId(null);
    setRejectReason("");
  };

  const handleChangeRole = async () => {
    if (!roleUserId) return;
    try {
      await apiUpdateUserRole(roleUserId, roleValue);
    } catch (e) {
      console.error("Role update failed:", e);
    }
    setUsers((u) => u.map((x) => (x.id === roleUserId ? { ...x, role: roleValue } : x)));
    setRoleUserId(null);
  };

  const handleBan = async (id: string) => {
    try {
      await apiUpdateUserRole(id, "banned");
    } catch (e) {
      console.error("Ban failed:", e);
    }
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, role: "banned" } : x)));
  };

  const openEditDialog = (u: typeof USERS[number]) => {
    setEditUserId(u.id);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserRole(u.role);
    setEditUserPhone((u as any).phone || "");
    setEditUserVerified(u.verified);
  };

  const handleSaveUser = async () => {
    if (!editUserId || !editUserName.trim() || !editUserEmail.trim()) return;
    const phone = editUserPhone.trim() || (users.find(u => u.id === editUserId) as any)?.phone || "";
    // 1. Update DB via API
    try {
      await apiUpdateProfile(editUserId, {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        phone,
      });
    } catch (e) {
      console.warn("updateProfile API failed:", e);
    }
    // 2. Reload from server (catches cascading changes)
    loadUsers();
    setEditUserId(null);

  };

  const deleteUserName = users.find((u) => u.id === deleteUserId)?.name ?? "";

  const openDeleteDialog = (id: string) => {
    setDeleteUserId(id);
    setDeleteConfirmText("");
    setDeleteError(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteUserId) return;
    const target = users.find((u) => u.id === deleteUserId);
    if (!target) return;
    if (deleteConfirmText.trim().toLowerCase() !== target.name.trim().toLowerCase()) {
      setDeleteError(true);
      return;
    }
    // Delete from DB via API
    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteProfile", userId: deleteUserId }),
      });
    } catch {}
    // Remove from local state
    setUsers((u) => u.filter((x) => x.id !== deleteUserId));
    setDeleteUserId(null);
    setDeleteConfirmText("");
    setDeleteError(false);
  };

  // Default help content — shared with /help page
  const contentDefaults: Record<ContentSection, string> = {
    howItWorks: `## Как работает SakhGo

SakhGo — нишевый маркетплейс для Сахалинской области и Курильских островов. Местные жители, гиды и собственники размещают объявления, а путешественники находят жильё, туры, рыбалку и снаряжение.

### Для путешественников

1. Найдите подходящее предложение — в каталоге или через поиск на главной
2. Отфильтруйте по типу, локации, цене и удобствам
3. Забронируйте — выберите даты и количество гостей, отправьте заявку
4. Дождитесь подтверждения — хост подтвердит или отклонит бронь
5. Оплатите после подтверждения хоста (оплата через T-Bank / Yookassa)
6. Приезжайте — вся информация о встрече в вашем кабинете

### Для организаторов

1. Зарегистрируйтесь как «Организатор / Собственник»
2. Подайте объявление через пошаговую форму в кабинете
3. Укажите все детали — категорию, цену, фото, удобства, правила
4. Дождитесь модерации — администратор проверит объявление
5. Принимайте брони — подтверждайте или отклоняйте входящие заявки
6. Зарабатывайте — деньги поступают после завершения услуги`,
    faq: `## Частые вопросы

### Как забронировать жильё или тур?

Выберите объявление в каталоге, укажите даты заезда/выезда и количество гостей, нажмите «Забронировать». Хост получит уведомление и подтвердит бронь.

### Нужна ли предоплата?

Да, после подтверждения хоста вы оплачиваете полную стоимость через T-Bank или Yookassa. Платёж защищён.

### Можно ли отменить бронирование?

Да, условия зависят от конкретного объявления. Подробнее — в разделе «Политика отмены».

### Как работает продвижение объявлений?

ТОП на 7–30 дней — объявление вверху каталога, от 2 990 ₽ · Горящие даты — значок привлекает внимание, 990 ₽ на 3 дня · Выделение цветом — яркая рамка в поиске, 1 490 ₽ на 7 дней.

### Нужен ли погранпропуск?

Для Курильских островов требуется оформление пропуска в погранзону. Хосты помогают с оформлением — уточняйте в описании.

### Что такое сушилка для снаряжения?

Оборудование для сушки лыж, сноубордов, ботинок. Особенно актуально рядом с СТК «Горный Воздух».

### Зависит ли морской выход от погоды?

Да. При неблагоприятном прогнозе дата переносится или делается полный возврат.`,
    cancelPolicy: `## Политика отмены

Каждое объявление имеет свои условия отмены. Перед бронью ознакомьтесь с ними в карточке объявления.

### Типичные условия возврата

За 7+ дней до заезда — возврат 100% · За 3–7 дней — возврат 50% · Менее 3 дней — возврат 0%.

### Особые случаи

Погодные условия для морских туров — полный возврат или перенос · Задержка авиарейсов на Курилы — даты сдвигаются, возврат не предусмотрен · Форс-мажор — рассматривается индивидуально.

### Как оформить отмену

Перейдите в «Мои бронирования», выберите бронь, нажмите «Отменить». Средства вернутся в течение 3–5 рабочих дней.`,
    support: `## Поддержка

### Контакты

Email: support@sakhalinstay.ru · Телефон: +7 (4242) 00-00-00 · Telegram: @sakhalinstay_support · Время работы: ежедневно 09:00–21:00 (GMT+11)

### Когда обращаться

Проблемы с бронью или оплатой · Вопросы по размещению объявлений · Спорные ситуации между гостем и хостом · Жалобы на недостоверную информацию · Технические проблемы с сайтом

### Экстренная связь

Если нет связи с хостом в день заезда — звоните по телефону поддержки.

### Юридическая информация

ООО «SakhGo» · 693000, г. Южно-Сахалинск, ул. Ленина, д. 123, офис 45 · ИНН 6500000000 · ОГРН 1234567890123`,
    hostInfo: `## Стать организатором

### Кто может разместить объявление

Любой житель Сахалинской области и Курил от 18 лет: собственники жилья (квартиры, дома, базы отдыха), гиды и проводники (туры, джип-туры), рыбаки и капитаны (рыбалка), владельцы снаряжения (джипы, снегоходы, сапы).

### Как начать

1. Зарегистрируйтесь — роль «Организатор / Собственник»
2. Заполните профиль — имя, телефон, локация
3. Подайте объявление через форму в кабинете
4. Дождитесь модерации (до 24 часов)
5. Принимайте брони после одобрения

### Требования к объявлениям

Реальные фотографии, не стоковые · Точный адрес или ориентир · Актуальные цены и условия · Контактный телефон.

### Комиссия

Базовое размещение — бесплатно · Продвижение — от 990 ₽.`,
    rules: `## Правила площадки

### Основные правила

1. Достоверность — все данные в объявлении должны быть правдивыми
2. Актуальность цен — цена не меняется после бронирования
3. Безопасность — запрещены опасные услуги без страховки
4. Фотографии — только реальные, не стоковые
5. Контакты — обмен только через платформу

### Запрещено

Недостоверные или мошеннические объявления · Дискриминация гостей по любому признаку · Навязывание услуг, не указанных в объявлении · Обход платформы (прямые расчёты) · Оскорбления, угрозы, нецензурная лексика.

### Модерация

Все новые объявления проверяются администратором. Срок — до 24 часов. При отклонении вы получите уведомление с причиной.`,
  };

  // Content key → store property mapping (must match both admin + help page)
  const keyToProp: Record<string, keyof typeof store> = {
    howItWorks: "helpHowItWorks",
    faq: "helpFAQ",
    cancelPolicy: "helpCancelPolicy",
    support: "helpSupport",
    hostInfo: "helpHostInfo",
    rules: "helpRules",
  };

  // Content editor
  const loadContent = (key: ContentSection) => {
    setContentKey(key);
    const prop = keyToProp[key] ?? key;
    const stored = store[prop] as string;
    setContentText(stored || contentDefaults[key]);
    setContentSaved(false);
  };
  const saveContent = () => {
    store.setHelpContent(contentKey, contentText);
    setContentSaved(true);
    setTimeout(() => setContentSaved(false), 2000);
  };

  // Minimal editor toolbar — insert markdown
  const insertMarkdown = (wrapper: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = contentText.slice(0, start);
    const selected = contentText.slice(start, end) || placeholder;
    const after = contentText.slice(end);
    const newText = before + wrapper.replace("{text}", selected) + after;
    setContentText(newText);
    // Restore cursor after state update
    setTimeout(() => {
      ta.focus();
      const cursorPos = start + wrapper.indexOf("{text}") + selected.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Bold, label: "Жирный", action: () => insertMarkdown("**{text}**", "жирный текст") },
    { icon: Italic, label: "Курсив", action: () => insertMarkdown("*{text}*", "курсив") },
    { icon: Heading, label: "Заголовок", action: () => insertMarkdown("\n## {text}\n", "Заголовок") },
    { icon: List, label: "Список", action: () => insertMarkdown("\n- {text}", "элемент списка") },
    { icon: ListOrdered, label: "Нумерованный", action: () => insertMarkdown("\n1. {text}", "пункт") },
  ];

  // Categories management
  const DEFAULT_CATEGORIES = [
    { id: "cat-1", key: "property", label: "Жильё", icon: "Home" },
    { id: "cat-2", key: "tour", label: "Туры", icon: "Map" },
    { id: "cat-3", key: "fishing", label: "Рыбалка", icon: "Fish" },
    { id: "cat-4", key: "rental_gear", label: "Снаряжение", icon: "Wrench" },
    { id: "cat-5", key: "car_rental", label: "Прокат авто", icon: "Car" },
  ];
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [catListingCounts, setCatListingCounts] = useState<Record<string, number>>({});
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatLabel, setEditCatLabel] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");

  // Auto-load content when switching to content tab
  useEffect(() => {
    if (tab === "content" && !contentText) {
      loadContent(contentKey);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load when switching section via select (handled in loadContent via onValueChange)

  const totalRevenue = PROMO_LOG
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.price, 0);

  // Find current section label
  const currentSectionLabel = HELP_SECTIONS.find((h) => h.key === contentKey)?.label ?? contentKey;

  // Access denied — not an admin
  if (!store.user || store.user.role !== "admin") {
    return (
      <>
        <Header />
        <AuthModal />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted" />
            <h1 className="font-display text-3xl mb-4">Доступ запрещён</h1>
            <p className="text-muted-foreground mb-6">
              Этот раздел доступен только администраторам.
              Войдите под учётной записью администратора.
            </p>
            {!store.user ? (
              <Button onClick={() => store.setAuthOpen(true)} className="gap-2">
                <Shield className="w-4 h-4" />
                Войти
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Вы вошли как <strong>{store.user.name}</strong> ({store.user.role})
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => { store.logout(); store.setAuthOpen(true); }}>
                    Сменить аккаунт
                  </Button>
                  <Button onClick={() => router.push("/dashboard")}>
                    В личный кабинет
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl">Админ-панель</h1>
            <p className="text-sm text-muted-foreground">Защищённый раздел · {store.user.name}</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Rocket className="w-3 h-3" />
              {headerBuilds.length > 0 ? `v${headerBuilds[0].version} · ${headerBuilds[0].date}` : <>v{BUILD_HISTORY[0].version} · {BUILD_HISTORY[0].date}</>}
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="flex gap-1 border-b mb-8 mt-6 overflow-x-auto">
          {([
            { id: "dashboard", label: "Дашборд", icon: BarChart3 },
            { id: "moderation", label: "Модерация", icon: Eye, count: pending.length },
            { id: "reviews", label: "Отзывы", icon: MessageSquare },
            { id: "users", label: "Пользователи", icon: Users, count: userTotal },
            { id: "payments", label: "Платные услуги", icon: Banknote },
            { id: "maintenance", label: "Техработы", icon: Wrench },
            { id: "categories", label: "Категории", icon: Tag, count: categories.length },
            { id: "banners", label: "Баннеры", icon: Megaphone },
            { id: "content", label: "Контент", icon: FileText },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id ? "border-red-600 text-red-600" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />{t.label}
              {("count" in t) && (
                <Badge variant="secondary" className="text-xs ml-1">{t.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* ── MODERATION ── */}

        {tab === "dashboard" && (
          <DashboardTab stats={stats} />
        )}

        {tab === "moderation" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl">Модерация объявлений</h2>
              <Badge className="text-sm px-3 py-1 bg-yellow-100 text-yellow-800 border-yellow-200">
                {pending.length} на проверке
              </Badge>
            </div>

            {pending.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg">Все объявления проверены</p>
                <p className="text-sm">Новых заявок на модерацию нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((l) => (
                  <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-yellow-200 rounded-lg p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={`/listings/${(l as any).listingId || l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-display text-lg text-foreground hover:text-accent hover:underline transition-colors"
                        >
                          {l.title}
                        </a>
                        <Badge variant="secondary" className="text-xs">{l.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{l.location} · Хост: {l.host}</p>
                      <p className="text-xs text-muted font-mono mt-1 tracking-wide">
                        {l.price.toLocaleString("ru-RU")} {l.unit} · Подано: {l.submitted}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`/listings/${(l as any).listingId || l.id}`, '_blank')}>
                        <Eye className="w-4 h-4" /> Посмотреть
                      </Button>
                      <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => handleApprove(l.id)}>
                        <CheckCircle className="w-4 h-4" /> Одобрить
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setRejectId(l.id)}>
                        <XCircle className="w-4 h-4" /> Отклонить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ── */}
        {tab === "reviews" && <ReviewsTab />}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl">Пользователи</h2>
              <Badge variant="secondary" className="text-sm">{userTotal} всего</Badge>
            </div>

            {/* Search + pagination toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или email..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  onKeyDown={(e) => { if (e.key === "Enter") loadUsers(e.currentTarget.value, 1); }}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage <= 1}
                  onClick={() => { const p = userPage - 1; setUserPage(p); loadUsers(undefined, p); }}
                >
                  ← Назад
                </Button>
                <span className="min-w-[80px] text-center">
                  {userTotal > 0 ? `${(userPage - 1) * USER_PAGE_SIZE + 1}–${Math.min(userPage * USER_PAGE_SIZE, userTotal)}` : "0"} из {userTotal}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage * USER_PAGE_SIZE >= userTotal}
                  onClick={() => { const p = userPage + 1; setUserPage(p); loadUsers(undefined, p); }}
                >
                  Вперёд →
                </Button>
              </div>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Пользователь</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Роль</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Вериф.</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Объявления</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Брони</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Дата регистрации</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                          {userSearch ? "Ничего не найдено" : "Нет пользователей"}
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className={cn("border-b hover:bg-muted/20 transition-colors", u.role === "banned" && "opacity-50")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs bg-accent text-accent-fg">{u.name[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn(
                              "text-xs font-semibold",
                              u.role === "admin" && "bg-red-100 text-red-700",
                              u.role === "host" && "bg-blue-100 text-blue-700",
                              u.role === "vendor" && "bg-purple-100 text-purple-700",
                              u.role === "traveler" && "bg-green-100 text-green-700",
                              u.role === "user" && "bg-green-100 text-green-700",
                              u.role === "banned" && "bg-gray-200 text-gray-500",
                            )}>
                              {u.role === "admin" ? "Админ" : u.role === "host" ? "Организатор" : u.role === "vendor" ? "Продавец" : u.role === "banned" ? "Заблокирован" : "Пользователь"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            {u.verified ? <CheckCircle className="w-4 h-4 text-green-500 inline" /> : <XCircle className="w-4 h-4 text-muted inline" />}
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">{u.listings}</td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">{u.bookings}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{u.joined}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => openEditDialog(u)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />Ред.
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => { setRoleUserId(u.id); setRoleValue(u.role); }}
                              >
                                <UserCog className="w-3.5 h-3.5 mr-1" />Роль
                              </Button>
                              {u.role !== "banned" && u.role !== "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-red-600 hover:text-red-700"
                                  onClick={() => handleBan(u.id)}
                                >
                                  <Ban className="w-3.5 h-3.5 mr-1" />Блок
                                </Button>
                              )}
                              {u.role === "banned" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-green-600 hover:text-green-700"
                                  onClick={async () => {
                                    try {
                                      await apiUpdateUserRole(u.id, "user");
                                    } catch (e) {}
                                    loadUsers();
                                  }}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />Разблок.
                                </Button>
                              )}
                              {u.role !== "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(u.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />Удалить
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENTS / PROMOTIONS ── */}
        {tab === "payments" && <PromotionsTab />}

        {tab === "maintenance" && (
          <div className="bg-card border rounded-xl p-6 max-w-lg mx-auto text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="font-display text-xl mb-2">Режим техработ</h2>
              <p className="text-sm text-muted-foreground">
                Включает красивую заглушку для всех посетителей.
                API продолжает работать, админка доступна.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
              SSH: <code className="text-blue-600">sudo bash /home/alex/sakhgo/maintenance.sh on|off|status</code>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const r = await fetch("/api/store", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "getMaintenanceStatus" }),
                  });
                  const d = await r.json();
                  alert(d.data?.maintenance ? "🔧 Техработы ВКЛЮЧЕНЫ" : "✅ Сайт работает");
                } catch { alert("Ошибка проверки"); }
              }}
            >
              Проверить статус
            </Button>
          </div>
        )}

        {/* ── CATEGORIES ── */}
        {tab === "categories" && (
          <div>
            <h2 className="font-display text-2xl mb-6">Управление категориями</h2>
            <p className="text-sm text-muted-foreground mb-6">Категории определяют разделы в шапке сайта и фильтры в каталоге.</p>

            {/* Add new */}
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Название новой категории"
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                className="max-w-sm"
              />
              <Button
                onClick={() => {
                  const trimmed = newCatLabel.trim();
                  if (!trimmed) return;
                  setCategories([...categories, {
                    id: `cat-${Date.now()}`,
                    key: trimmed.toLowerCase().replace(/\s+/g, "_"),
                    label: trimmed,
                    icon: "Tag",
                  }]);
                  setNewCatLabel("");
                }}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" /> Добавить
              </Button>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Название</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Ключ</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Объявлений</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {editingCatId === cat.id ? (
                          <Input
                            value={editCatLabel}
                            onChange={(e) => setEditCatLabel(e.target.value)}
                            className="max-w-[200px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setCategories((c) => c.map((x) => x.id === cat.id ? { ...x, label: editCatLabel } : x));
                                setEditingCatId(null);
                              }
                              if (e.key === "Escape") setEditingCatId(null);
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-accent/10 rounded flex items-center justify-center text-[10px] text-accent font-semibold">
                              {cat.label[0].toUpperCase()}
                            </div>
                            <span className="font-medium">{cat.label}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">{cat.key}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">
                        {catListingCounts[cat.key] ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => { setEditingCatId(cat.id); setEditCatLabel(cat.label); }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Ред.
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`Удалить категорию «${cat.label}»? Объявления без категории станут невидимыми.`)) {
                                setCategories((c) => c.filter((x) => x.id !== cat.id));
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BANNERS ── */}
        {tab === "banners" && (
          <BannersTab />
        )}

        {/* ── BUILDS ── */}

        {/* ── CONTENT EDITOR ── */}
        {tab === "content" && (
          <div>
            <h2 className="font-display text-2xl mb-6">Редактирование раздела «Помощь»</h2>

            <div className="bg-card border rounded-xl p-6 space-y-4">
              <div className="space-y-2">
                <Label>Раздел</Label>
                <Select value={contentKey} onValueChange={(v) => loadContent(v as ContentSection)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {currentSectionLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {HELP_SECTIONS.map((h) => (
                      <SelectItem key={h.key} value={h.key}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Редактор</Label>

                {/* Minimal toolbar */}
                <div className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-md border">
                  {toolbarButtons.map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={btn.action}
                      className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                      title={btn.label}
                    >
                      <btn.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                  <div className="w-px h-5 bg-border mx-1" />
                  <span className="text-[10px] text-muted-foreground px-1">Markdown</span>
                </div>

                <Textarea
                  ref={textareaRef}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  rows={18}
                  className="font-mono text-xs"
                  placeholder="Введите текст раздела..."
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={saveContent}
                  className="gap-1.5"
                >
                  {contentSaved ? (
                    <><CheckCircle className="w-4 h-4" /> Сохранено</>
                  ) : (
                    <><Save className="w-4 h-4" /> Сохранить</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) setRejectId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Причина отклонения</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>Укажите причину (будет отправлена хосту)</Label>
            <Textarea
              placeholder="Например: несоответствие категории, недостаточно фото, недостоверная информация..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Отклонить объявление
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={(v) => { if (!v) { setDeleteUserId(null); setDeleteError(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Удаление пользователя
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">Это действие необратимо</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Все объявления пользователя <strong className="text-foreground">{deleteUserName}</strong> будут удалены</li>
                <li>Все бронирования будут отменены</li>
                <li>Все личные данные — безвозвратно удалены</li>
                <li>Возврат средств гостям — оформляется вручную</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Для подтверждения введите имя пользователя: <strong>{deleteUserName}</strong>
              </Label>
              <Input
                placeholder={`Введите «${deleteUserName}»`}
                value={deleteConfirmText}
                onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(false); }}
                className={cn(deleteError && "border-destructive ring-1 ring-destructive/30")}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                autoFocus
              />
              {deleteError && (
                <p className="text-xs text-destructive">Имя не совпадает. Проверьте написание.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteUserId(null); setDeleteError(false); }}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!deleteConfirmText.trim()}
            >
              Удалить пользователя
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUserId} onOpenChange={(v) => { if (!v) setEditUserId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" />
              Редактировать пользователя
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input value={editUserPhone} onChange={(e) => setEditUserPhone(e.target.value)} placeholder="+79990000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserId(null)}>Отмена</Button>
            <Button onClick={handleSaveUser} disabled={!editUserName.trim() || !editUserEmail.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={!!roleUserId} onOpenChange={(v) => { if (!v) setRoleUserId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Сменить роль</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>Новая роль</Label>
            <Select value={roleValue} onValueChange={(v) => setRoleValue(v ?? "")}>
              <SelectTrigger><SelectValue>{ROLE_LABELS[roleValue] ?? roleValue}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="traveler">Путешественник</SelectItem>
                <SelectItem value="host">Организатор / Собственник</SelectItem>
                <SelectItem value="vendor">Продавец (vendor)</SelectItem>
                <SelectItem value="admin">Администратор (admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUserId(null)}>Отмена</Button>
            <Button onClick={handleChangeRole}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Banners Tab Component ──

function BannersTab() {
  const store = useStore();
  const banners = store.banners;
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [contentMode, setContentMode] = useState<"image" | "html">("image");
  const [slot, setSlot] = useState<Banner["slot"]>("home-hero-bottom");
  const [addErr, setAddErr] = useState("");

  const SLOT_OPTIONS: { value: Banner["slot"]; label: string }[] = [
    { value: "home-hero-bottom", label: "Главная — под поиском" },
    { value: "catalog-sidebar", label: "Каталог — боковая панель" },
    { value: "listing-detail-bottom", label: "Карточка объявления — низ" },
    { value: "search-results-top", label: "Результаты поиска — верх" },
  ];

  const toggleActive = (id: string, current: boolean) => {
    store.updateBanner(id, { active: !current });
  };

  return (
    <div>
      <h2 className="font-display text-2xl mb-2">Управление баннерами</h2>
      <p className="text-sm text-muted-foreground mb-6">Размещайте рекламные баннеры в выбранных местах на сайте. Поддерживается HTML-код, iframe, embed.</p>

      {/* Add Banner Form */}
      <div className="bg-card border rounded-xl p-6 mb-8">
        <h3 className="font-display text-lg mb-4">Добавить баннер</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input placeholder="Спецпредложение от партнёра" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ссылка при клике</Label>
            <Input placeholder="https://partner-site.ru/offer" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Место размещения</Label>
            <Select value={slot} onValueChange={(v) => setSlot(v as Banner["slot"])}>
              <SelectTrigger><SelectValue>{SLOT_OPTIONS.find((s) => s.value === slot)?.label ?? slot}</SelectValue></SelectTrigger>
              <SelectContent>
                {SLOT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Тип содержимого</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setContentMode("image")}
                className={cn("flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                  contentMode === "image" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                🖼️ URL картинки
              </button>
              <button
                onClick={() => setContentMode("html")}
                className={cn("flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                  contentMode === "html" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                💻 HTML-код
              </button>
            </div>
          </div>
        </div>

        {contentMode === "image" ? (
          <div className="space-y-2 mb-4">
            <Label>Изображение (URL)</Label>
            <Input placeholder="https://example.com/banner.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <Label>HTML-код баннера</Label>
            <textarea
              className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-lg bg-muted/30 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder={`<div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 24px; border-radius: 8px; text-align: center; color: white;">
  <h3 style="margin: 0 0 8px; font-size: 18px;">Спецпредложение!</h3>
  <p style="margin: 0; font-size: 14px; opacity: 0.9;">Скидка 20% на все туры</p>
</div>`}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Можно вставить любой HTML: картинки, стили, iframe, embed-код. Баннер будет кликабельным (ссылка выше).
            </p>
          </div>
        )}

        {addErr && <p className="text-sm text-destructive mb-2">{addErr}</p>}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (!title.trim()) { setAddErr("Укажите название"); return; }
              if (!linkUrl.trim()) { setAddErr("Укажите ссылку"); return; }
              if (contentMode === "image" && !imageUrl.trim()) { setAddErr("Укажите URL картинки или переключитесь на HTML"); return; }
              if (contentMode === "html" && !htmlContent.trim()) { setAddErr("Вставьте HTML-код или переключитесь на URL картинки"); return; }
              store.addBanner({
                title: title.trim(),
                imageUrl: contentMode === "image" ? imageUrl.trim() : "",
                htmlContent: contentMode === "html" ? htmlContent : undefined,
                linkUrl: linkUrl.trim(),
                slot,
                active: true,
                startDate: new Date().toISOString(),
                endDate: null,
              });
              setTitle(""); setImageUrl(""); setLinkUrl(""); setHtmlContent(""); setContentMode("image"); setAddErr("");
            }}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" /> Добавить баннер
          </Button>
        </div>
      </div>

      {/* Banner List */}
      {banners.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">Нет баннеров</p>
          <p className="text-sm">Добавьте первый баннер через форму выше</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Баннер</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Место</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Тип</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Активен</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Показы</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Клики</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id} className={cn("border-b hover:bg-muted/20 transition-colors", !b.active && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {b.htmlContent ? (
                        <div className="w-10 h-10 rounded bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-mono font-bold text-violet-600">&lt;/&gt;</span>
                        </div>
                      ) : b.imageUrl ? (
                        <img src={b.imageUrl} className="w-10 h-10 rounded object-cover bg-muted shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center shrink-0">
                          <Megaphone className="w-4 h-4 text-accent" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{b.title}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{b.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {SLOT_OPTIONS.find((s) => s.value === b.slot)?.label ?? b.slot}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {b.htmlContent ? (
                      <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 bg-violet-50">HTML</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Изобр.</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(b.id, b.active)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                        b.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {b.active ? "Да" : "Нет"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{b.impressions.toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{b.clicks.toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm(`Удалить баннер «${b.title}»?`)) store.removeBanner(b.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Builds Tab Component ──

interface BuildEntry {
  version: string;
  date: string;
  description: string;
  changes: string[];
  hash: string;
}

const BUILD_HISTORY: BuildEntry[] = [
  {
    version: "1.6.0",
    date: "2026-08-05",
    description: "Монетизация: ЮKassa + реальные платежи за продвижение",
    hash: "9057667",
    changes: [
      "Полная цепочка монетизации: заявка → платёж ЮKassa → активация",
      "lib/yookassa.ts: initYooKassaPayment + проверка вебхуков",
      "Новая страница /dashboard/payment/result — статус оплаты",
      "initYooKassaPayment в OWNER_PARAM (только хост своего объявления)",
      "Тестовый simulatePayment (админ) для отладки без реальных денег",
      "PromoteModal: передача durationDays + price для создания заявки",
      "dbUpdatePromotionStatus: авто-установка/снятие promo на listing",
    ],
  }, 
  {
    version: "1.5.0",
    date: "2026-08-05",
    description: "Восстановление пароля + VK ID аутентификация",
    changes: [
      "Модалка входа: режим «Забыли пароль?», отправка ссылки на email",
      "Страница /reset-password: сброс пароля по токену из URL",
      "DB: dbCreatePasswordResetToken + dbResetPassword (1 час)",
      "Email: sendPasswordResetEmail (HTML-письмо с 🔐)",
      "API: forgotPassword + resetPassword",
      "Миграция 008: password_reset_token + password_reset_expires",
      "Миграция 009: vk_id в таблице profiles",
      "DB: dbFindProfileByVkId, dbLinkVkId, dbCreateProfileFromVk",
      "VK: PKCE (code_verifier + code_challenge SHA-256)",
      "VK: callback → createSession + профиль в БД",
      "API: getMe — текущий пользователь из сессии",
      "Клиент: apiGetMe + fetchMe + хендлер ?vk_auth=ok",
    ],
    hash: "35beb9d"
  },
  {
    version: "1.4.2",
    date: "2026-08-05",
    description: "Исправления: двойной формат params + QA-тестирование",
    changes: [
      "API: поддержка плоского и вложенного JSON (исправлен вход в админку)",
      "Безопасность: verifyListingOwner и verifyBookingParticipant теперь вызываются",
      "Безопасность: 401 для неавторизованных, 403 для чужих ресурсов",
      "Модалка: тип режима включает 'forgot'",
      "QA: скрипт подтверждает все страницы отдают 200, защита активна",
    ],
    hash: "2194f75"
  },

  {
    version: "1.4.1",
    date: "2026-08-05",
    description: "Аудит безопасности: закрытие уязвимостей",
    changes: [
      "session.ts: ключ из SESSION_SECRET вместо хардкода",
      "API: getListingByIdAdmin только для админов (ADMIN_ONLY)",
      "API: addListingImage/removeListingImage проверяют владельца",
      "API: addBooking/addReview через OWNER_PARAM",
      "API: updateBookingStatus проверяет участника бронирования",
      "API: incrementPromoClick/getListingStats требуют сессию",
      "API: удалён DROP TABLE из createMessagesTable",
      "middleware: /admin защищён через verifySessionToken",
      "DB: sanitizeUser убирает password_hash и verification_code",
      "upload/route.ts: magic byte check (jpg/png/webp), max 2MB",
      "db.ts: dbUpdateBanner column whitelist",
      "pg.ts: mandatory DB_PASSWORD",
    ],
    hash: "8f5682e"
  },
  {
    version: "1.4.0",
    date: "2026-08-05",
    description: "Серверная сессия: HMAC cookie, санитизация пользователя, защита админки",
    changes: [
      "session.ts: Web Crypto API, HMAC-SHA256 cookie signing, Edge-compatible",
      "route.ts: ADMIN_ONLY for 22 actions, OWNER_PARAM for 16 actions",
      "route.ts: createSession on login/register, clearSession on logout",
      "route.ts: sanitizeUser on profile returns (no password_hash/code)",
      "middleware.ts: block /admin without valid session",
      "db.ts: dbGetAllProfiles maps through sanitizeUser",
      ".env.local: SESSION_SECRET via openssl rand -hex 32",
    ],
    hash: "3203b8c"
  },
  {
    version: "1.3.1",
    date: "2026-08-04",
    description: "Админка: просмотр непроверенных объявлений, фикс загрузки",
    changes: [
      "Кнопка просмотра непроверенных объявлений",
      "db.ts: dbGetListingByIdAdmin без фильтра active/verified",
      "route.ts: getListingByIdAdmin",
      "Клиент: исправлена проверка поля verified",
      "Загрузка: исправлен путь public/uploads",
    ],
    hash: "d76be8e"
  },

  {
    version: "1.3.0",
    date: "2026-08-04",
    description: "Исправление карточек + переезд на конфигурацию через env",
    changes: [
      "Карточки: убраны «до X гостей» и «X дн.» для проката авто и снаряжения",
      "pg.ts: параметры подключения к БД через переменные окружения",
      "Сервер: .env.local с DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME",
      "Сервер: pg_hba.conf — добавлен md5 для localhost",
    ],
    hash: "249e0a1"
  },
  {
    version: "1.2.0",
    date: "2026-08-01",
    description: "Промо-акции, статистика, быстрые подборки, поиск",
    changes: [
      "Промо-акции: таблицы, API, вкладка админки, панель продавца, авто-истечение, учёт кликов",
      "Статистика: listing_stats, generate_series за 7 дней с заполнением нулями, гистограмма, сводка",
      "Админка: удаление пользователей, количество в категориях из БД, enum car_rental",
      "Coming-soon страница: живой океан на canvas, звёзды, луна, волны, птицы, обратный отсчёт",
      "Быстрые подборки: слайдер из 4 карточек, автоповорот, пауза при наведении, точки-индикаторы",
      "Hero-поиск: одна поисковая строка с чип-подсказками, медведь сбоку",
    ],
    hash: "7f3c2b8"
  },
  {
    version: "1.1.0",
    date: "2026-07-31",
    description: "Регистрация, мобильная адаптация",
    changes: [
      "Регистрация: формат телефона +7 XXX XXX-XX-XX, валидация, проверка дубликатов email и телефона",
      "Мобильная адаптация: адаптивный header с гамбургер-меню, уменьшенные отступы",
    ],
    hash: "a1b2c3d"
  },
  {
    version: "1.0.0",
    date: "2026-07-30",
    description: "Первый публичный билд",
    changes: [
      "Маркетплейс: жильё, туры, рыбалка, снаряжение, прокат авто",
      "Каталог, карточки объявлений, страница объявления",
      "Личный кабинет: создание и управление объявлениями",
      "Бронирования, чат, избранное",
      "Админ-панель: модерация, пользователи, контент, баннеры",
      "SSL через Let's Encrypt, Nginx reverse proxy, PM2",
    ],
    hash: "e5f6g7h"
  },
];

function BuildsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">История сборок</h2>
        <Badge className="text-sm px-3 py-1">
          {BUILD_HISTORY.length} сборок
        </Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-8">
          {BUILD_HISTORY.map((build, idx) => (
            <div key={build.version} className="relative pl-12">
              {/* Timeline dot */}
              <div className={cn(
                "absolute left-2.5 w-3.5 h-3.5 rounded-full border-2 border-background ring-2",
                idx === 0 ? "bg-primary ring-primary/30" : "bg-muted-foreground/30 ring-muted-foreground/20"
              )} />

              <div className={cn(
                "rounded-xl border p-5",
                idx === 0 ? "bg-primary/5 border-primary/20" : "bg-card"
              )}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl font-bold tracking-tight">v{build.version}</span>
                    {idx === 0 && <Badge className="bg-primary text-primary-foreground text-xs">Актуальная</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{build.date}</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{build.hash}</code>
                  </div>
                </div>

                <p className="text-sm font-medium text-foreground mb-3">{build.description}</p>

                <ul className="space-y-1.5">
                  {build.changes.map((change, ci) => (
                    <li key={ci} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground mb-1">
          <Rocket className="w-4 h-4 text-primary" />
          Текущая версия на сервере
        </p>
        <p>v{BUILD_HISTORY[0].version} · Собрано {BUILD_HISTORY[0].date} · Хэш {BUILD_HISTORY[0].hash}</p>
        <p className="mt-1">Сервер: 192.168.85.87 · HTTPS (Let's Encrypt) · Next.js + PostgreSQL · PM2</p>
      </div>
    </div>
  );
}
