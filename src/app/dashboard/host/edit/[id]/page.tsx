"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useStore, labelFromType, formatPrice, priceUnit, HostListing } from "@/lib/store";
import { apiGetHostListingById } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { LOCATIONS, LISTING_LABELS } from "@/lib/data";
import { ArrowLeft, Check, Save, Upload, X, MapPin, Star, Eye } from "lucide-react";
import { RichTextEditor } from "@/components/richtext-editor";

// ── Constants ──

const AMENITY_OPTIONS = [
  "Wi-Fi","Парковка","Вид на горы","Вид на море","Сушилка для снаряжения/лыж","Камин",
  "Баня/Сауна","Кондиционер","Стиральная машина","Кухня","Терраса","Мангал","Трансфер","Можно с животными",
];
const DIFFICULTY_OPTIONS = [
  { v: "easy", l: "Лёгкий" }, { v: "medium", l: "Средний" }, { v: "hard", l: "Сложный" }, { v: "extreme", l: "Экстремальный" },
];
const FISH_SPECIES_OPTIONS = ["Горбуша","Кета","Сима","Кунджа","Таймень","Камбала","Палтус","Треска","Корюшка"];
const INCLUDES_OPTIONS = ["Трансфер","Обед","Снаряжение","Страховка","Гид","Фото","Проживание"];
const FISHING_TYPE_OPTIONS = [
  { v: "rechnaya", l: "Речная" }, { v: "morskaya", l: "Морская" },
  { v: "ozernaya", l: "Озёрная" }, { v: "podlednaya", l: "Подлёдная" }, { v: "splav", l: "Сплав" },
];
const FISHING_METHOD_OPTIONS = ["Спиннинг","Нахлыст","Поплавочная","Троллинг","Донная"];
const TRANSPORT_OPTIONS = ["Джип","Катер","Пешком","Вертолёт","Лыжи","Снегоход","Каяк","Рафт"];
const GUEST_OPTIONS = [1,2,3,4,5,6,8,10,12,16,20];
const ROOM_OPTIONS = ["1","2","3","4","5+"];
const BED_OPTIONS = ["1","2","3","4","5","6","8","10+"];

const SEASON_VARIANTS = [
  { v: "all_season", l: "Всесезон" },
  { v: "winter", l: "Зима" },
  { v: "summer", l: "Лето" },
] as const;

const TYPE_LABEL_MAP: Record<string, string> = {
  property: "Жильё", tour: "Тур", fishing: "Рыбалка", rental_gear: "Снаряжение",
};

const TYPE_BG: Record<string, string> = {
  property: "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]",
  tour: "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]",
  fishing: "from-[#70A8B0] via-[#388890] to-[#186068]",
  rental_gear: "from-[#C8C0B8] via-[#A09888] to-[#686050]",
};

const TYPE_EMOJI: Record<string, string> = {
  property: "🏠", tour: "🏔️", fishing: "🎣", rental_gear: "🔧",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Лёгкий", medium: "Средний", hard: "Сложный", extreme: "Экстремальный",
};

// ── Types ──

interface EditForm {
  title: string; type: string; price: number; location: string; address: string;
  season: string; description: string; descriptionHtml: string;
  maxGuests: string; roomsCount: string; bedsCount: string;
  amenities: string[]; cancellationPolicy: string; images: string[];
  tourDurationDays: string; tourDurationHours: string; difficultyLevel: string;
  includes: string[]; groupSizeMin: string; groupSizeMax: string; startPoint: string;
  requiresBorderPermit: boolean; dependsOnWeather: boolean; transportIncluded: boolean;
  fishingType: string; fishSpecies: string[]; fishingMethod: string;
  gearIncluded: boolean; catchGuarantee: string; licenseRequired: boolean;
  boatIncluded: boolean; mealsIncluded: boolean;
  transportType: string; gearCondition: string;
}

const INITIAL: EditForm = {
  title:"", type:"property", price:0, location:"Южно-Сахалинск", address:"", season:"all_season",
  description:"", descriptionHtml:"", maxGuests:"2", roomsCount:"1", bedsCount:"1",
  amenities:[], cancellationPolicy:"", images:[],
  tourDurationDays:"1", tourDurationHours:"", difficultyLevel:"", includes:[],
  groupSizeMin:"1", groupSizeMax:"4", startPoint:"", requiresBorderPermit:false,
  dependsOnWeather:false, transportIncluded:false,
  fishingType:"", fishSpecies:[], fishingMethod:"", gearIncluded:false,
  catchGuarantee:"", licenseRequired:false, boatIncluded:false, mealsIncluded:false,
  transportType:"", gearCondition:"",
};

// ── Preview helpers ──

function buildPreviewMeta(f: EditForm): string[] {
  const meta: string[] = [];
  if (f.type === "property") {
    if (f.roomsCount) meta.push(`${f.roomsCount} комн.`);
    if (f.bedsCount) meta.push(`${f.bedsCount} спальных мест`);
  }
  if (f.maxGuests) meta.push(`до ${f.maxGuests} гостей`);
  if (f.type === "tour") {
    if (f.tourDurationDays) meta.push(`${f.tourDurationDays} дн.`);
    if (f.difficultyLevel && DIFFICULTY_LABEL[f.difficultyLevel]) meta.push(DIFFICULTY_LABEL[f.difficultyLevel]);
  }
  if (f.type === "fishing") {
    if (f.fishingType) {
      const ft = FISHING_TYPE_OPTIONS.find(o => o.v === f.fishingType);
      if (ft) meta.push(ft.l);
    }
    if (f.boatIncluded) meta.push("Катер");
  }
  if (f.type === "rental_gear") {
    if (f.transportType) meta.push(f.transportType);
    if (f.gearCondition) meta.push(f.gearCondition);
  }
  if (f.amenities.length > 0) {
    f.amenities.slice(0, 2).forEach(a => meta.push(a));
  }
  return meta.slice(0, 4);
}

// ── Component ──

export default function EditListingPage() {
  const params = useParams();
  const id = params.id as string;
  const store = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<EditForm>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<HostListing | null>(
    store.myListings.find(l => l.id === id) || null
  );

  // If listing not in store, fetch from API
  useEffect(() => {
    if (!store.user) { router.push("/"); return; }
    const stored = store.myListings.find(l => l.id === id);
    if (stored) { setListing(stored); setLoading(false); return; }
    // Fetch from API
    (async () => {
      try {
        const remote = await apiGetHostListingById(id, store.user?.id || "");
        if (remote) {
          const remoteListing: HostListing = {
            id: remote.id,
            hostId: remote.host_id || remote.hostId || "",
            title: remote.title,
            type: remote.type,
            location: remote.location,
            price: typeof remote.price === "number" ? remote.price : parseInt(String(remote.price)) || 0,
            priceUnit: priceUnit(remote.type),
            rating: remote.rating ?? null,
            views: remote.views ?? 0,
            bookingsCount: remote.bookings_count ?? remote.bookingsCount ?? 0,
            active: remote.active ?? true,
            verified: remote.verified ?? false,
            promo: remote.promo ?? null,
            coverImage: remote.cover_image ?? remote.coverImage ?? null,
            images: remote.images ?? [],
            description: remote.description,
            maxGuests: remote.max_guests ?? remote.maxGuests,
            roomsCount: remote.rooms_count ?? remote.roomsCount,
            bedsCount: remote.beds_count ?? remote.bedsCount,
            amenities: remote.amenities ?? [],
            season: remote.season,
            createdAt: remote.created_at ?? remote.createdAt,
          } as any;
          store.mergeListing(remoteListing);
          setListing(remoteListing);
        }
      } catch { /* stay on loading if API fails */ }
      setLoading(false);
    })();
  }, [id, store.user, router]);

  useEffect(() => {
    if (!store.user || !listing) { if (!loading) router.push("/dashboard"); return; }
    setForm(f => ({
      ...f,
      title: listing.title || "",
      type: listing.type || "property",
      price: listing.price || 0,
      location: listing.location || "",
      address: (listing as any).address || "",
      images: listing.images || [],
      description: listing.description || "",
      descriptionHtml: listing.description || "",
      maxGuests: String(listing.maxGuests || "2"),
      roomsCount: String(listing.roomsCount || "1"),
      bedsCount: String(listing.bedsCount || "1"),
      amenities: listing.amenities || [],
      season: listing.season || (listing as any).season || "all_season",
      tourDurationDays: String((listing as any).tourDurationDays || "1"),
      tourDurationHours: String((listing as any).tourDurationHours || ""),
      difficultyLevel: (listing as any).difficultyLevel || "",
      includes: (listing as any).includes || [],
      groupSizeMin: String((listing as any).groupSizeMin || "1"),
      groupSizeMax: String((listing as any).groupSizeMax || "4"),
      startPoint: (listing as any).startPoint || "",
      requiresBorderPermit: (listing as any).requiresBorderPermit ?? false,
      dependsOnWeather: (listing as any).dependsOnWeather ?? false,
      transportIncluded: (listing as any).transportIncluded ?? false,
      fishingType: (listing as any).fishingType || "",
      fishSpecies: (listing as any).fishSpecies || [],
      fishingMethod: (listing as any).fishingMethod || "",
      gearIncluded: (listing as any).gearIncluded ?? false,
      catchGuarantee: (listing as any).catchGuarantee || "",
      licenseRequired: (listing as any).licenseRequired ?? false,
      boatIncluded: (listing as any).boatIncluded ?? false,
      mealsIncluded: (listing as any).mealsIncluded ?? false,
      transportType: (listing as any).transportType || "",
      gearCondition: (listing as any).gearCondition || "",
      cancellationPolicy: (listing as any).cancellationPolicy || "",
    }));
  }, [listing, store.user, router, loading]);

  // ── Form state helpers ──
  const update = <K extends keyof EditForm>(k: K, v: EditForm[K]) => setForm(f => ({...f, [k]: v}));
  function sel(k: keyof EditForm) { return (v: string | null) => { if (v != null) update(k, v as EditForm[typeof k]); }; }
  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true); const newImages: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`Фото «${file.name}» больше 2 МБ — пропущено`);
        continue;
      }
      if (form.images.length + newImages.length >= 5) break;
      const fd = new FormData(); fd.append("file", file);
      try { const r = await fetch("/api/upload", { method:"POST", body:fd }); const j = await r.json(); if (j.ok) newImages.push(j.data.url); else toast.error(j.error || "Ошибка загрузки"); } catch {
        toast.error(`Не удалось загрузить «${file.name}»`);
      }
    }
    if (newImages.length) { update("images", [...form.images, ...newImages]); toast.success(`Добавлено ${newImages.length} фото`); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !store.user || !listing) return;
    const changes: Record<string, string> = {};
    const fields: (keyof EditForm)[] = [
      "title","type","location","description","maxGuests","roomsCount","bedsCount",
      "season","tourDurationDays","tourDurationHours","difficultyLevel",
      "fishingType","fishingMethod","catchGuarantee","gearCondition","transportType",
      "cancellationPolicy","address","startPoint",
    ];
    for (const k of fields) {
      const v = form[k] as string;
      const lv = (listing as any)[k] ?? "";
      if (String(v) !== String(lv)) changes[k] = String(v);
    }
    if (form.price !== listing.price) changes.price = String(form.price);
    if (form.groupSizeMin !== String((listing as any).groupSizeMin ?? "1")) changes.groupSizeMin = form.groupSizeMin;
    if (form.groupSizeMax !== String((listing as any).groupSizeMax ?? "4")) changes.groupSizeMax = form.groupSizeMax;
    if (JSON.stringify(form.amenities) !== JSON.stringify(listing.amenities || [])) changes.amenities = JSON.stringify(form.amenities);
    if (JSON.stringify(form.includes) !== JSON.stringify((listing as any).includes || [])) changes.includes = JSON.stringify(form.includes);
    if (JSON.stringify(form.fishSpecies) !== JSON.stringify((listing as any).fishSpecies || [])) changes.fishSpecies = JSON.stringify(form.fishSpecies);
    if (JSON.stringify(form.images) !== JSON.stringify(listing.images || [])) changes.images = JSON.stringify(form.images);
    const boolFields: (keyof EditForm)[] = ["requiresBorderPermit","dependsOnWeather","transportIncluded","gearIncluded","licenseRequired","boatIncluded","mealsIncluded"];
    for (const k of boolFields) {
      if (form[k] !== ((listing as any)[k] ?? false)) changes[k] = String(form[k]);
    }

    if (Object.keys(changes).length === 0) { router.push("/dashboard"); return; }

    // Submit to moderation (store the edit request)
    const allChanges = { ...changes, images: form.images };
    await store.requestListingEdit({
      listingId: id,
      listingTitle: form.title.trim() || listing.title,
      hostId: store.user.id,
      hostName: store.user.name,
      changes: allChanges,
    });
    setSaved(true);
    setTimeout(() => router.push("/dashboard"), 1200);
  };

  // ── Preview meta ──
  const previewMeta = useMemo(() => buildPreviewMeta(form), [form]);

  if (!listing) return null;

  // ── Conditional section render helper ──
  const renderTourFields = () => (
    <div className="space-y-6">
      <Separator className="!my-6" />
      <h3 className="font-display text-lg">Параметры тура</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Длительность (дней)</Label>
          <Select value={form.tourDurationDays} onValueChange={sel("tourDurationDays")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["1","2","3","5","7","10","14"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Время в пути (часов)</Label>
          <Input type="number" value={form.tourDurationHours} onChange={e => update("tourDurationHours", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Мин. группа</Label>
          <Select value={form.groupSizeMin} onValueChange={sel("groupSizeMin")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["1","2","3","4","5","8"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Макс. группа</Label>
          <Select value={form.groupSizeMax} onValueChange={sel("groupSizeMax")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["2","4","6","8","10","15","20"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Сложность</Label>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTY_OPTIONS.map(d => (
            <button key={d.v} onClick={() => update("difficultyLevel", d.v)}
              className={cn("p-3 border rounded-lg text-sm text-left transition-colors",
                form.difficultyLevel === d.v ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30")}>{d.l}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Что включено</Label>
        <div className="flex flex-wrap gap-2">
          {INCLUDES_OPTIONS.map(item => (
            <button key={item} onClick={() => update("includes", toggleArr(form.includes, item))}
              className={cn("px-3 py-1.5 text-sm border rounded-full transition-colors",
                form.includes.includes(item) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground")}>
              {form.includes.includes(item) && <Check className="w-3 h-3 inline mr-1" />}{item}
            </button>
          ))}
        </div>
      </div>
      {(["requiresBorderPermit","dependsOnWeather","transportIncluded"] as const).map(k => {
        const L: Record<string,string> = {
          requiresBorderPermit: "Нужен пропуск в погранзону",
          dependsOnWeather: "Зависит от погоды",
          transportIncluded: "Трансфер включён",
        };
        return (
          <button key={k} onClick={() => update(k, !form[k])}
            className={cn("w-full flex justify-between items-center p-3 border rounded-lg text-sm transition-colors",
              form[k] ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30")}>
            {L[k]}
            <span className={cn("w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0",
              form[k] ? "bg-accent border-accent text-white" : "border-muted")}>{form[k] ? "✓" : ""}</span>
          </button>
        );
      })}
      <div className="space-y-2">
        <Label>Точка старта</Label>
        <Input value={form.startPoint} onChange={e => update("startPoint", e.target.value)} placeholder="Площадь Ленина, Южно-Сахалинск" />
      </div>
    </div>
  );

  const renderFishingFields = () => (
    <div className="space-y-6">
      <Separator className="!my-6" />
      <h3 className="font-display text-lg">Параметры рыбалки</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Тип рыбалки</Label>
          <Select value={form.fishingType} onValueChange={sel("fishingType")}>
            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>{FISHING_TYPE_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Способ</Label>
          <Select value={form.fishingMethod} onValueChange={sel("fishingMethod")}>
            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>{FISHING_METHOD_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Виды рыбы</Label>
        <div className="flex flex-wrap gap-2">
          {FISH_SPECIES_OPTIONS.map(s => (
            <button key={s} onClick={() => update("fishSpecies", toggleArr(form.fishSpecies, s))}
              className={cn("px-3 py-1.5 text-sm border rounded-full transition-colors",
                form.fishSpecies.includes(s) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground")}>
              {form.fishSpecies.includes(s) && <Check className="w-3 h-3 inline mr-1" />}{s}
            </button>
          ))}
        </div>
      </div>
      {(["gearIncluded","boatIncluded","mealsIncluded","licenseRequired","requiresBorderPermit"] as const).map(k => {
        const L: Record<string,string> = {
          gearIncluded: "Снаряжение включено", boatIncluded: "Катер/лодка включены",
          mealsIncluded: "Питание включено", licenseRequired: "Лицензия",
          requiresBorderPermit: "Погранпропуск",
        };
        return (
          <button key={k} onClick={() => update(k, !form[k])}
            className={cn("w-full flex justify-between items-center p-3 border rounded-lg text-sm transition-colors",
              form[k] ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30")}>
            {L[k]}
            <span className={cn("w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0",
              form[k] ? "bg-accent border-accent text-white" : "border-muted")}>{form[k] ? "✓" : ""}</span>
          </button>
        );
      })}
      <div className="space-y-2">
        <Label>Гарантия улова</Label>
        <div className="flex flex-wrap gap-2">
          {["Гарантия улова","Без гарантии","Обучение"].map(g => (
            <button key={g} onClick={() => update("catchGuarantee", g)}
              className={cn("px-4 py-2 text-sm border rounded-lg transition-colors",
                form.catchGuarantee === g ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30")}>{g}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRentalGearFields = () => (
    <div className="space-y-6">
      <Separator className="!my-6" />
      <h3 className="font-display text-lg">Характеристики снаряжения</h3>
      <div className="space-y-2">
        <Label>Тип транспорта / снаряжения</Label>
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_OPTIONS.map(t => (
            <button key={t} onClick={() => update("transportType", t)}
              className={cn("px-4 py-2 text-sm border rounded-lg transition-colors",
                form.transportType === t ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Состояние</Label>
        <div className="flex flex-wrap gap-2">
          {["Новое","Отличное","Хорошее","Удовлетворительное"].map(c => (
            <button key={c} onClick={() => update("gearCondition", c)}
              className={cn("px-4 py-2 text-sm border rounded-lg transition-colors",
                form.gearCondition === c ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30")}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Toaster position="top-right" richColors />
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="ltr">
        {/* ── Back link ── */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        <h1 className="font-display text-3xl mb-2">Редактировать объявление</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Изменения отправятся на модерацию и будут видны после одобрения.
        </p>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* ── LEFT COLUMN (2/3): Form ── */}
          <div className="flex-[2] space-y-8 min-w-0">

            {/* ── Section: Основное ── */}
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Основное</h2>

              <div className="space-y-2">
                <Label>Название *</Label>
                <Input value={form.title} onChange={e => update("title", e.target.value)} maxLength={120}
                  placeholder="напр. «Квартира у СТК Горный Воздух»" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select value={form.type} onValueChange={sel("type")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABEL_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Цена (₽)</Label>
                  <Input type="number" value={String(form.price)} min={0}
                    onChange={e => update("price", Math.max(0, Number(e.target.value)) || 0)}
                    placeholder="4500" />
                </div>
              </div>
            </section>

            {/* ── Section: Локация и сезон ── */}
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Локация и сезон</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Локация *</Label>
                  <Select value={form.location} onValueChange={sel("location")}>
                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Сезон</Label>
                  <div className="flex gap-1">
                    {SEASON_VARIANTS.map(({ v, l }) => (
                      <button key={v} type="button" onClick={() => update("season", v)}
                        className={cn("flex-1 px-3 py-2 text-xs border rounded-lg transition-colors",
                          form.season === v ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Адрес или ориентир</Label>
                <Input value={form.address} onChange={e => update("address", e.target.value)}
                  placeholder="ул. Горная, 5 / 500 м от СТК Горный Воздух" />
              </div>
            </section>

            {/* ── Section: Размещение (только для property) ── */}
            {form.type === "property" && (
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Размещение</h2>

              <div className="grid grid-cols-3 gap-4">
                {([
                  ["Гостей", form.maxGuests, GUEST_OPTIONS, "maxGuests"] as const,
                  ["Комнат", form.roomsCount, ROOM_OPTIONS, "roomsCount"] as const,
                  ["Спальных мест", form.bedsCount, BED_OPTIONS, "bedsCount"] as const,
                ]).map(([label, val, opts, key]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Select value={val} onValueChange={sel(key)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {opts.map(n => <SelectItem key={String(n)} value={String(n)}>{String(n)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
            )}

            {/* ── Section: Удобства (только для property) ── */}
            {form.type === "property" && (
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Удобства</h2>

              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => update("amenities", toggleArr(form.amenities, a))}
                    className={cn("px-3 py-1.5 text-sm border rounded-full transition-colors",
                      form.amenities.includes(a) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground")}>
                    {form.amenities.includes(a) && <Check className="w-3 h-3 inline mr-1" />}{a}
                  </button>
                ))}
              </div>
            </section>
            )}

            {/* ── Section: Фотографии ── */}
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Фотографии</h2>

              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple
                onChange={handleFileUpload} className="hidden" />
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {form.images.map((img, i) => (
                  <div key={i} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                    <img src={img} alt={`Фото ${i+1}`} className="w-full h-full object-cover" />
                    <button onClick={() => update("images", form.images.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-white/80 rounded-full flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {form.images.length < 5 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center
                      justify-center gap-1 hover:border-accent hover:bg-accent/5 transition-colors">
                    {uploading ? (
                      <span className="text-xs text-muted-foreground animate-pulse">Загрузка...</span>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Добавить</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG или WebP. Максимум 2 МБ на фото, до 5 штук.
              </p>
            </section>

            {/* ── Section: Описание ── */}
            <section className="space-y-4">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Описание</h2>

              <RichTextEditor
                value={form.descriptionHtml}
                onChange={(html, text) => { update("descriptionHtml", html); update("description", text); }}
                placeholder="Опишите объявление подробно..."
              />
            </section>

            {/* ── Conditional Sections ── */}
            {form.type === "tour" && renderTourFields()}
            {form.type === "fishing" && renderFishingFields()}
            {form.type === "rental_gear" && renderRentalGearFields()}

            {/* ── Section: Политика отмены ── */}
            <section className="space-y-4">
              <Separator />
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Политика отмены</h2>
              <div className="space-y-2">
                <Input value={form.cancellationPolicy} onChange={e => update("cancellationPolicy", e.target.value)}
                  placeholder="Бесплатная отмена за 24 часа до заезда..." />
              </div>
            </section>

            {/* ── Submit bar ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t">
              <p className="text-xs text-muted-foreground">Изменения отправятся на модерацию, применятся после одобрения.</p>
              <div className="flex gap-2 self-end sm:self-auto">
                <Button variant="outline" onClick={() => router.back()}>Отмена</Button>
                <Button onClick={handleSubmit} disabled={!form.title.trim() || saved}>
                  {saved ? (
                    <><Check className="w-4 h-4 mr-1" />Отправлено</>
                  ) : (
                    <><Save className="w-4 h-4 mr-1" />Отправить на модерацию</>
                  )}
                </Button>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN (1/3): Live Preview ── */}
          <aside className="flex-1 lg:max-w-sm">
            <div className="sticky top-24 space-y-3">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Eye className="w-4 h-4" /> Предпросмотр
              </h2>

              {/* ── Preview Card ── */}
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                {/* Image area */}
                <div className={cn(
                  "aspect-[4/3] relative overflow-hidden",
                  form.images.length === 0 && "bg-gradient-to-br " + (TYPE_BG[form.type] || "from-slate-200 via-slate-300 to-slate-400"),
                )}>
                  {form.images.length > 0 ? (
                    <img src={form.images[0]} alt={form.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display italic text-4xl text-white/25">
                        {TYPE_EMOJI[form.type] || "📋"}
                      </span>
                    </div>
                  )}

                  {/* Type badge */}
                  <Badge variant="secondary" className="absolute top-3 left-3 bg-white/90 text-foreground border font-mono text-[11px]">
                    {TYPE_LABEL_MAP[form.type] || form.type}
                  </Badge>

                  {/* Season badge */}
                  {form.season && form.season !== "all_season" && (
                    <Badge className="absolute top-3 left-[4.5rem] bg-white/90 text-foreground border font-mono text-[11px]">
                      {(() => { const s = SEASON_VARIANTS.find(x => x.v === form.season); return s ? s.l : form.season; })()}
                    </Badge>
                  )}

                  {/* Image count */}
                  {form.images.length > 1 && (
                    <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {form.images.length} фото
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  {/* Location */}
                  <p className="text-xs uppercase tracking-widest text-accent font-medium">
                    <MapPin className="w-3 h-3 inline mr-0.5" />
                    {form.location || "Не выбрана"}
                  </p>

                  {/* Title */}
                  <h3 className="font-display text-lg leading-tight">
                    {form.title.trim() || "Название объявления"}
                  </h3>

                  {/* Description preview (2 lines) */}
                  {form.description.trim() ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{form.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic">Описание не заполнено</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-2">
                    {previewMeta.map((m, i) => (
                      <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {m}
                      </span>
                    ))}
                    {previewMeta.length === 0 && (
                      <span className="text-xs text-muted-foreground/50 italic">Детали не указаны</span>
                    )}
                  </div>

                  {/* Price row */}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div>
                      <span className="font-display text-xl">{formatPrice(form.price || 0)}</span>
                      <span className="text-xs text-muted-foreground ml-1">{priceUnit(form.type)}</span>
                    </div>
                    {listing.rating != null && (
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <Star className="w-3.5 h-3.5 text-amber fill-amber" />
                        {Number(listing.rating).toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* Bookmarks count */}
                  <p className="text-xs text-muted-foreground">
                    Просмотров: {listing.views ?? 0} · Броней: {listing.bookingsCount ?? 0}
                  </p>
                </div>
              </div>

              {/* ── Quick hints ── */}
              <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
                <p className="font-medium text-foreground mb-1">Что видно в карточке:</p>
                <ul className="list-disc ml-4 space-y-0.5 text-muted-foreground/80">
                  <li>Первое фото или градиент</li>
                  <li>Тип и сезон (бейджи)</li>
                  <li>Название и локация</li>
                  <li>Первые 2 строки описания</li>
                  <li>До 4 мета-деталей под тип</li>
                  <li>Цена, рейтинг, статистика</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
