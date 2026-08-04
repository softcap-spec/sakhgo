"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATIONS, LISTING_LABELS } from "@/lib/data";
import { ListingType } from "@/lib/types";
import {
  ArrowLeft, ArrowRight, Building2, Car, Check, Compass,
  Fish, Home, MapPin, Upload, Waves, X
} from "lucide-react";

// ── types ──
type Step = 1 | 2 | 3 | 4 | 5;

interface ListingForm {
  listing_type: ListingType | null;
  category_id: string | null;

  // шаг 2
  title: string;
  description: string;
  price_per_night: string;
  deposit_amount: string;
  currency: string;

  // шаг 3 — жильё
  rooms_count: string;
  beds_count: string;
  bathrooms_count: string;
  max_guests: string;
  area_sqm: string;
  amenities: string[];
  check_in_time: string;
  check_out_time: string;

  // шаг 3 — туры / рыбалка
  tour_duration_hours: string;
  tour_duration_days: string;
  difficulty_level: string;
  includes: string[];
  group_size_min: string;
  group_size_max: string;
  start_point: string;
  requires_border_permit: boolean;
  depends_on_weather: boolean;
  transport_included: boolean;

  // шаг 3 — рыбалка
  fishing_type: string;
  fish_species: string[];
  fishing_method: string;
  gear_included: boolean;
  catch_guarantee: string;
  license_required: boolean;
  boat_included: boolean;
  meals_included: boolean;

  // шаг 3 — аренда
  transport_type: string;
  gear_condition: string;

  // шаг 4
  location_tag: string;
  address: string;
  season: string;
  cancellation_policy: string;
  images: string[];
}

const CATEGORY_OPTIONS: Record<ListingType, { value: string; label: string; icon: typeof Home }[]> = {
  property: [
    { value: "kvartiry", label: "Квартира", icon: Building2 },
    { value: "doma-u-morya", label: "Дом у моря", icon: Waves },
    { value: "bazy-otdyha", label: "База отдыха", icon: Home },
    { value: "gostevye-doma", label: "Гостевой дом", icon: Home },
  ],
  tour: [
    { value: "dzhip-tury", label: "Джип-тур", icon: Car },
    { value: "morskie-vyhody", label: "Морской выход", icon: Waves },
    { value: "kurily", label: "Тур на Курилы", icon: MapPin },
    { value: "firraid", label: "Фрирайд / Ски-тур", icon: Compass },
  ],
  fishing: [
    { value: "rybalka-rechnaya", label: "Речная рыбалка", icon: Waves },
    { value: "rybalka-morskaya", label: "Морская рыбалка", icon: Compass },
    { value: "rybalka-podlednaya", label: "Подлёдная рыбалка", icon: Fish },
    { value: "rybalka-splav", label: "Сплав / Рафтинг", icon: Compass },
  ],
  rental_gear: [
    { value: "avto-moto", label: "Авто / Мото", icon: Car },
    { value: "vodny-sport", label: "Водный спорт", icon: Waves },
    { value: "turisticheskoe", label: "Туристическое снаряжение", icon: Compass },
    { value: "zimnee", label: "Зимнее снаряжение", icon: Compass },
  ],
  car_rental: [
    { value: "vnedorozhniki", label: "Внедорожники", icon: Car },
    { value: "legkovye", label: "Легковые", icon: Car },
    { value: "mikroavtobusy", label: "Микроавтобусы", icon: Car },
    { value: "mototexnika", label: "Мототехника", icon: Compass },
  ],
};

const AMENITY_OPTIONS = [
  "Wi-Fi", "Парковка", "Вид на горы", "Вид на море",
  "Сушилка для снаряжения/лыж", "Камин", "Баня/Сауна",
  "Кондиционер", "Стиральная машина", "Полностью оборудованная кухня",
  "Балкон/Терраса", "Мангал", "Трансфер от аэропорта", "Можно с животными",
];

const FISH_SPECIES_OPTIONS = [
  "Горбуша", "Кета", "Сима", "Кунджа",
  "Таймень", "Камбала", "Палтус", "Треска", "Корюшка",
];

const INCLUDES_OPTIONS = [
  "Трансфер из Южно-Сахалинска", "Обед", "Снаряжение",
  "Страховка", "Услуги гида", "Фотосъёмка", "Проживание",
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Лёгкий — подходит для начинающих" },
  { value: "medium", label: "Средний — нужна базовая подготовка" },
  { value: "hard", label: "Сложный — для опытных" },
  { value: "extreme", label: "Экстремальный — только профи" },
];

const FISHING_TYPE_OPTIONS = [
  { value: "rechnaya", label: "Речная" },
  { value: "morskaya", label: "Морская" },
  { value: "ozernaya", label: "Озёрная" },
  { value: "podlednaya", label: "Подлёдная" },
  { value: "splav", label: "Сплав" },
];

const FISHING_METHOD_OPTIONS = [
  "Спиннинг", "Нахлыст", "Поплавочная", "Троллинг", "Донная",
];

const TRANSPORT_OPTIONS = [
  "Джип", "Катер", "Пешком", "Вертолёт", "Лыжи", "Снегоход", "Каяк", "Рафт",
];

const INITIAL_FORM: ListingForm = {
  listing_type: null,
  category_id: null,
  title: "",
  description: "",
  price_per_night: "",
  deposit_amount: "",
  currency: "RUB",
  rooms_count: "1",
  beds_count: "1",
  bathrooms_count: "1",
  max_guests: "2",
  area_sqm: "",
  amenities: [],
  check_in_time: "14:00",
  check_out_time: "12:00",
  tour_duration_hours: "",
  tour_duration_days: "1",
  difficulty_level: "",
  includes: [],
  group_size_min: "1",
  group_size_max: "4",
  start_point: "",
  requires_border_permit: false,
  depends_on_weather: false,
  transport_included: false,
  fishing_type: "",
  fish_species: [],
  fishing_method: "",
  gear_included: false,
  catch_guarantee: "",
  license_required: false,
  boat_included: false,
  meals_included: false,
  transport_type: "",
  gear_condition: "",
  location_tag: "Южно-Сахалинск",
  address: "",
  season: "all_season",
  cancellation_policy: "",
  images: [],
};

export default function CreateListingWizard() {
  const store = useStore();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const goBack = () => {
    if (step === 1) router.push("/dashboard/host");
    else setStep((s) => (s - 1) as Step);
  };

  const goNext = () => { if (step < 5) setStep((s) => (s + 1) as Step); };

  const canProceedStep1 = form.listing_type !== null;
  const canProceedStep2 = form.title.trim() !== "" && form.price_per_night.trim() !== "";
  const canProceedStep4 = form.location_tag !== "";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      if (form.images.length + newImages.length >= 5) break;
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body });
        const json = await res.json();
        if (json.ok) {
          newImages.push(json.data.url);
        }
      } catch (err) {
        console.warn("Upload failed for", file.name, err);
      }
    }

    if (newImages.length > 0) {
      update("images", [...form.images, ...newImages]);
    }
    setUploading(false);
    // reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!store.user) return;
    const listingId = await store.addListing({
      hostId: store.user.id,
      title: form.title,
      type: form.listing_type || "property",
      location: form.location_tag,
      price: Number(form.price_per_night) || 0,
      images: form.images,
      description: form.description,
      maxGuests: Number(form.max_guests) || 2,
      roomsCount: Number(form.rooms_count) || 1,
      bedsCount: Number(form.beds_count) || 1,
      amenities: form.amenities,
      season: form.season,
      cancellationPolicy: form.cancellation_policy,
      tourDurationDays: Number(form.tour_duration_days) || undefined,
      tourDurationHours: Number(form.tour_duration_hours) || undefined,
      difficultyLevel: form.difficulty_level || undefined,
      includes: form.includes,
      requiresBorderPermit: form.requires_border_permit,
      transportIncluded: form.transport_included,
      fishingType: form.fishing_type || undefined,
      fishSpecies: form.fish_species,
      fishingMethod: form.fishing_method || undefined,
      gearIncluded: form.gear_included,
      catchGuarantee: form.catch_guarantee || undefined,
      licenseRequired: form.license_required,
      boatIncluded: form.boat_included,
      mealsIncluded: form.meals_included,
      transportType: form.transport_type || undefined,
      gearCondition: form.gear_condition || undefined,
    });

    router.push("/dashboard/host");
  };

  // ── Step indicator ──
  const steps = [
    { n: 1, label: "Тип и категория" },
    { n: 2, label: "Основная информация" },
    { n: 3, label: "Параметры" },
    { n: 4, label: "Фото и локация" },
    { n: 5, label: "Предпросмотр" },
  ];

  // ── Bottom navigation bar ──
  const Nav = () => (
    <div className="flex items-center justify-between pt-6 mt-6 border-t">
      <Button variant="outline" onClick={goBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        {step === 1 ? "В кабинет" : "Назад"}
      </Button>

      {step < 5 ? (
        <Button
          onClick={goNext}
          disabled={
            (step === 1 && !canProceedStep1) ||
            (step === 2 && !canProceedStep2) ||
            (step === 4 && !canProceedStep4)
          }
        >
          Далее
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      ) : (
        <Button onClick={handleSubmit}>
          <Check className="w-4 h-4 mr-1" />
          Отправить на модерацию
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => s.n < step && setStep(s.n as Step)}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 transition-colors ${
                step > s.n
                  ? "bg-accent text-accent-fg cursor-pointer"
                  : step === s.n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.n ? <Check className="w-4 h-4" /> : s.n}
            </button>
            <span className={`text-xs hidden sm:block whitespace-nowrap ${step >= s.n ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < 4 && <div className={`flex-1 h-0.5 ${step > s.n ? "bg-accent" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1 · Тип и категория ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-1">Какой тип объявления?</h2>
            <p className="text-muted-foreground text-sm">Выберите категорию размещения</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(LISTING_LABELS) as [ListingType, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { update("listing_type", k); update("category_id", null); }}
                className={`p-5 border-2 rounded-xl text-left transition-all ${
                  form.listing_type === k ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium text-base">{label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {k === "property" && "Квартиры, дома, базы отдыха"}
                  {k === "tour" && "Экскурсии, джип-туры, морские выходы"}
                  {k === "fishing" && "Речная, морская и подлёдная рыбалка"}
                  {k === "rental_gear" && "Лыжи, лодки, туристическое снаряжение"}
                  {k === "car_rental" && "Внедорожники, легковые, микроавтобусы, мототехника"}
                </div>
              </button>
            ))}
          </div>

          {form.listing_type && (
            <div className="space-y-3">
              <Label>Уточните категорию</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS[form.listing_type].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => update("category_id", cat.value)}
                    className={`flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                      form.category_id === cat.value ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <cat.icon className="w-5 h-5 text-accent" />
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Nav />
        </div>
      )}

      {/* ── STEP 2 · Основная информация ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-1">Основная информация</h2>
            <p className="text-muted-foreground text-sm">Расскажите гостям о вашем предложении</p>
          </div>

          <div className="space-y-2">
            <Label>Название объявления *</Label>
            <Input placeholder="напр. «Квартира у СТК Горный Воздух»" value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea placeholder="Опишите, что включено, какие условия, что с собой взять..." value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Цена *</Label>
              <Input type="number" placeholder={form.listing_type === "property" ? "за ночь, ₽" : form.listing_type === "rental_gear" ? "за сутки, ₽" : form.listing_type === "car_rental" ? "за сутки, ₽" : "за человека, ₽"} value={form.price_per_night} onChange={(e) => update("price_per_night", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Залог (если есть)</Label>
              <Input type="number" placeholder="Сумма залога, ₽" value={form.deposit_amount} onChange={(e) => update("deposit_amount", e.target.value)} />
            </div>
          </div>

          {form.listing_type !== "rental_gear" && form.listing_type !== "car_rental" && (
          <div className="space-y-2">
            <Label>Максимум гостей</Label>
            <Select value={form.max_guests} onValueChange={(v) => update("max_guests", v ?? "")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,8,10,12,16,20].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          <Nav />
        </div>
      )}

      {/* ── STEP 3 · Специфика ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-1">Параметры</h2>
            <p className="text-muted-foreground text-sm">
              {form.listing_type === "property" && "Характеристики жилья"}
              {form.listing_type === "tour" && "Детали тура или экскурсии"}
              {form.listing_type === "fishing" && "Параметры рыбалки"}
              {form.listing_type === "rental_gear" && "Характеристики снаряжения"}
            </p>
          </div>

          {/* ── PROPERTY ── */}
          {form.listing_type === "property" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {([
                  { k: "rooms_count", l: "Комнат", vs: ["1","2","3","4","5+"] },
                  { k: "beds_count", l: "Спальных мест", vs: ["1","2","3","4","5","6","8","10+"] },
                  { k: "bathrooms_count", l: "Санузлов", vs: ["1","2","3"] },
                  { k: "area_sqm", l: "Площадь, м²", vs: [] },
                ] as const).map(({ k, l, vs }) => (
                  <div key={k} className="space-y-2">
                    <Label>{l}</Label>
                    {vs.length > 0 ? (
                      <Select value={String(form[k] || "1")} onValueChange={(v) => update(k, v ?? "")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{vs.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input type="number" placeholder="м²" value={form.area_sqm} onChange={(e) => update("area_sqm", e.target.value)} />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Удобства</Label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((a) => (
                    <button
                      key={a}
                      onClick={() => update("amenities", toggleArray(form.amenities, a))}
                      className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                        form.amenities.includes(a) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {form.amenities.includes(a) && <Check className="w-3 h-3 inline mr-1" />}
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Время заезда</Label><Input type="time" value={form.check_in_time} onChange={(e) => update("check_in_time", e.target.value)} /></div>
                <div className="space-y-2"><Label>Время выезда</Label><Input type="time" value={form.check_out_time} onChange={(e) => update("check_out_time", e.target.value)} /></div>
              </div>
            </>
          )}

          {/* ── TOUR ── */}
          {form.listing_type === "tour" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Длительность (дней)</Label>
                  <Select value={form.tour_duration_days} onValueChange={(v) => update("tour_duration_days", v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["0","1","2","3","5","7","10","14"].map((v) => <SelectItem key={v} value={v}>{v === "0" ? "Менее дня" : v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Время в пути (часов)</Label>
                  <Input type="number" placeholder="часов за тур" value={form.tour_duration_hours} onChange={(e) => update("tour_duration_hours", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Мин. размер группы</Label>
                  <Select value={form.group_size_min} onValueChange={(v) => update("group_size_min", v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["1","2","3","4","5","8","10"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Макс. размер группы</Label>
                  <Select value={form.group_size_max} onValueChange={(v) => update("group_size_max", v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["2","4","6","8","10","15","20","30"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Сложность</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => update("difficulty_level", d.value)}
                      className={`p-3 border rounded-lg text-sm text-left transition-colors ${
                        form.difficulty_level === d.value ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                      }`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Что включено</Label>
                <div className="flex flex-wrap gap-2">
                  {INCLUDES_OPTIONS.map((item) => (
                    <button
                      key={item}
                      onClick={() => update("includes", toggleArray(form.includes, item))}
                      className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                        form.includes.includes(item) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {form.includes.includes(item) && <Check className="w-3 h-3 inline mr-1" />}
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Сахалинская специфика</Label>
                <div className="space-y-2">
                  {([
                    { k: "requires_border_permit", label: "Нужен пропуск в погранзону (Курилы)" },
                    { k: "depends_on_weather", label: "Зависит от погодных условий / шторма" },
                    { k: "transport_included", label: "Трансфер из Южно-Сахалинска включён" },
                  ] as const).map(({ k, label }) => (
                    <button
                      key={k}
                      onClick={() => update(k, !form[k])}
                      className={`w-full flex items-center justify-between p-3 border rounded-lg text-left text-sm transition-colors ${
                        form[k] ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      {label}
                      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${form[k] ? "bg-accent border-accent text-accent-fg" : "border-muted"}`}>
                        {form[k] ? "✓" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Точка старта</Label>
                <Input placeholder="напр. «Площадь Ленина, Южно-Сахалинск»" value={form.start_point} onChange={(e) => update("start_point", e.target.value)} />
              </div>
            </>
          )}

          {/* ── FISHING ── */}
          {form.listing_type === "fishing" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип рыбалки</Label>
                  <Select value={form.fishing_type} onValueChange={(v) => update("fishing_type", v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>{FISHING_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Способ ловли</Label>
                  <Select value={form.fishing_method} onValueChange={(v) => update("fishing_method", v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>{FISHING_METHOD_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Длительность (дней)</Label>
                  <Select value={form.tour_duration_days} onValueChange={(v) => update("tour_duration_days", v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["0","1","2","3","5","7"].map((v) => <SelectItem key={v} value={v}>{v === "0" ? "Менее дня" : v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Макс. участников</Label>
                  <Select value={form.group_size_max} onValueChange={(v) => update("group_size_max", v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["2","3","4","5","6","8","10"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Виды рыбы</Label>
                <div className="flex flex-wrap gap-2">
                  {FISH_SPECIES_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => update("fish_species", toggleArray(form.fish_species, s))}
                      className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                        form.fish_species.includes(s) ? "bg-accent text-accent-fg border-accent" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {form.fish_species.includes(s) && <Check className="w-3 h-3 inline mr-1" />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Условия</Label>
                {([
                  { k: "gear_included", label: "Снаряжение включено в стоимость" },
                  { k: "boat_included", label: "Катер / лодка включены" },
                  { k: "meals_included", label: "Питание включено" },
                  { k: "license_required", label: "Требуется лицензия / путёвка" },
                  { k: "requires_border_permit", label: "Нужен пропуск в погранзону" },
                  { k: "depends_on_weather", label: "Зависит от погодных условий" },
                ] as const).map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => update(k, !form[k])}
                    className={`w-full flex items-center justify-between p-3 border rounded-lg text-left text-sm transition-colors ${
                      form[k] ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    {label}
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${form[k] ? "bg-accent border-accent text-accent-fg" : "border-muted"}`}>
                      {form[k] ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Гарантия улова</Label>
                <div className="flex gap-2">
                  {["Гарантия улова", "Без гарантии", "Обучение"].map((g) => (
                    <button
                      key={g}
                      onClick={() => update("catch_guarantee", g)}
                      className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                        form.catch_guarantee === g ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                      }`}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── RENTAL GEAR ── */}
          {form.listing_type === "rental_gear" && (
            <>
              <div className="space-y-2">
                <Label>Тип транспорта / снаряжения</Label>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORT_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => update("transport_type", t)}
                      className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                        form.transport_type === t ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Состояние</Label>
                <div className="flex gap-2">
                  {["Новое", "Отличное", "Хорошее", "Удовлетворительное"].map((c) => (
                    <button
                      key={c}
                      onClick={() => update("gear_condition", c)}
                      className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                        form.gear_condition === c ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Что включено в комплект</Label>
                <Textarea placeholder="Опишите состав комплекта..." value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
              </div>

              <div className="space-y-3">
                {([
                  { k: "requires_border_permit", label: "Нужен пропуск в погранзону" },
                  { k: "depends_on_weather", label: "Зависит от погодных условий" },
                ] as const).map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => update(k, !form[k])}
                    className={`w-full flex items-center justify-between p-3 border rounded-lg text-left text-sm transition-colors ${
                      form[k] ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    {label}
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${form[k] ? "bg-accent border-accent text-accent-fg" : "border-muted"}`}>
                      {form[k] ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── CAR RENTAL ── */}
          {form.listing_type === "car_rental" && (
            <>
              <div className="space-y-2">
                <Label>Категория автомобиля</Label>
                <div className="flex flex-wrap gap-2">
                  {["Внедорожник", "Легковой", "Микроавтобус", "Мотоцикл", "Квадроцикл / Снегоход"].map((c) => (
                    <button key={c} onClick={() => update("transport_type", c)}
                      className={`px-4 py-2 text-sm border rounded-lg transition-colors ${form.transport_type === c ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"}`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Трансмиссия</Label>
                <div className="flex gap-2">
                  {["Механика", "Автомат"].map((t) => (
                    <button key={t} onClick={() => update("difficulty_level", t)}
                      className={`px-4 py-2 text-sm border rounded-lg transition-colors ${form.difficulty_level === t ? "border-accent bg-accent/5" : "border-border hover:bg-muted/30"}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Nav />
        </div>
      )}

      {/* ── STEP 4 · Фото и локация ── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-1">Фото и локация</h2>
            <p className="text-muted-foreground text-sm">Добавьте фотографии и укажите местоположение</p>
          </div>

          <div className="space-y-2">
            <Label>Фотографии (до 5)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                  <img src={img} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => update("images", form.images.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {form.images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="text-xs text-muted-foreground animate-pulse">Загрузка...</span>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Добавить</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Поддерживаются JPG и PNG. Максимум 2 МБ на фото, до 5 штук.
            </p>
          </div>

          <div className="border-t my-6" />

          <div className="space-y-2">
            <Label>Населённый пункт / локация *</Label>
            <Select value={form.location_tag} onValueChange={(v) => update("location_tag", v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Выберите локацию" /></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Адрес или ориентир</Label>
            <Input placeholder="ул. Горная, 5 / 500 м от СТК Горный Воздух" value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Сезон</Label>
            <div className="flex gap-2">
              {[
                { value: "all_season", label: "Всесезон" },
                { value: "winter", label: "Зима" },
                { value: "summer", label: "Лето" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update("season", s.value)}
                  className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                    form.season === s.value ? "border-accent bg-accent/5 font-medium" : "border-border hover:bg-muted/30"
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Политика отмены</Label>
            <Textarea placeholder="Опишите условия отмены бронирования..." value={form.cancellation_policy} onChange={(e) => update("cancellation_policy", e.target.value)} rows={2} />
          </div>

          <Nav />
        </div>
      )}

      {/* ── STEP 5 · Предпросмотр ── */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-1">Предпросмотр</h2>
            <p className="text-muted-foreground text-sm">Так ваше объявление увидят гости</p>
          </div>

          <Card className="overflow-hidden border-2 border-accent/20">
            {form.images.length > 0 ? (
              <div className="aspect-[16/9] bg-muted overflow-hidden">
                <img src={form.images[0]} alt={form.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[16/9] bg-gradient-to-br from-slate-200 via-blue-100 to-slate-300 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="text-4xl mb-2">
                    {form.listing_type === "property" ? "🏠" : form.listing_type === "tour" ? "🏔️" : form.listing_type === "fishing" ? "🎣" : "🔧"}
                  </div>
                  <p className="text-sm">Нет фото</p>
                </div>
              </div>
            )}
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2">{form.listing_type ? LISTING_LABELS[form.listing_type] : "—"}</Badge>
                  <h3 className="font-display text-xl">{form.title || "Без названия"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {form.location_tag || "Локация не указана"}
                    {form.address && ` · ${form.address}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-2xl">{form.price_per_night ? Number(form.price_per_night).toLocaleString("ru-RU") : "—"} ₽</div>
                  <div className="text-xs text-muted-foreground">
                    {form.listing_type === "property" ? "за ночь" : form.listing_type === "rental_gear" ? "за сутки" : "за человека"}
                  </div>
                </div>
              </div>

              {form.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{form.description}</p>
              )}

              <div className="border-t my-6" />

              {/* Property specifics */}
              {form.listing_type === "property" && (
                <div className="flex flex-wrap gap-4 text-sm">
                  {form.rooms_count && <span className="text-muted-foreground">{form.rooms_count} комн.</span>}
                  {form.beds_count && <span className="text-muted-foreground">{form.beds_count} мест</span>}
                  {form.max_guests && <span className="text-muted-foreground">до {form.max_guests} гостей</span>}
                  {form.bathrooms_count && <span className="text-muted-foreground">{form.bathrooms_count} с/у</span>}
                  {form.area_sqm && <span className="text-muted-foreground">{form.area_sqm} м²</span>}
                </div>
              )}
              {form.listing_type === "property" && form.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.amenities.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                </div>
              )}
              {form.listing_type === "property" && form.deposit_amount && (
                <p className="text-sm text-muted-foreground">Залог: {Number(form.deposit_amount).toLocaleString("ru-RU")} ₽</p>
              )}

              {/* Tour specifics */}
              {form.listing_type === "tour" && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    {form.tour_duration_days && <span>{form.tour_duration_days} дн.</span>}
                    {form.tour_duration_hours && <span>{form.tour_duration_hours} ч. в пути</span>}
                    <span>{form.group_size_min}–{form.group_size_max} чел.</span>
                    {form.difficulty_level && <Badge variant="secondary" className="text-xs">{
                      DIFFICULTY_OPTIONS.find((d) => d.value === form.difficulty_level)?.label.split(" —")[0]
                    }</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.requires_border_permit && <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">Погранпропуск</Badge>}
                    {form.depends_on_weather && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">По погоде</Badge>}
                    {form.transport_included && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Трансфер включён</Badge>}
                  </div>
                  {form.includes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.includes.map((item) => <Badge key={item} variant="outline" className="text-xs">{item}</Badge>)}
                    </div>
                  )}
                  {form.start_point && <p className="text-sm text-muted-foreground">Старт: {form.start_point}</p>}
                </div>
              )}

              {/* Fishing specifics */}
              {form.listing_type === "fishing" && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    {form.fishing_type && <Badge variant="secondary" className="text-xs">{FISHING_TYPE_OPTIONS.find((o) => o.value === form.fishing_type)?.label}</Badge>}
                    {form.fishing_method && <span>{form.fishing_method}</span>}
                    <span>{form.group_size_min}–{form.group_size_max} чел.</span>
                  </div>
                  {form.fish_species.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.fish_species.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {form.gear_included && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Снаряжение вкл.</Badge>}
                    {form.boat_included && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Катер вкл.</Badge>}
                    {form.meals_included && <Badge variant="outline" className="text-xs border-green-300 text-green-700">Питание вкл.</Badge>}
                    {form.license_required && <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">Лицензия</Badge>}
                    {form.catch_guarantee && <Badge variant="outline" className="text-xs">{form.catch_guarantee}</Badge>}
                  </div>
                </div>
              )}

              {/* Rental specifics */}
              {form.listing_type === "rental_gear" && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-4">
                    {form.transport_type && <Badge variant="secondary" className="text-xs">{form.transport_type}</Badge>}
                    {form.gear_condition && <span className="text-muted-foreground">{form.gear_condition}</span>}
                    {form.deposit_amount && <span className="text-muted-foreground">Залог: {Number(form.deposit_amount).toLocaleString("ru-RU")} ₽</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.requires_border_permit && <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">Погранпропуск</Badge>}
                    {form.depends_on_weather && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">По погоде</Badge>}
                  </div>
                </div>
              )}

              <div className="border-t my-6" />

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {form.season && <span>Сезон: {form.season === "all_season" ? "Всесезон" : form.season === "winter" ? "Зима" : "Лето"}</span>}
                {form.cancellation_policy && <span className="max-w-md truncate">Отмена: {form.cancellation_policy}</span>}
              </div>
            </CardContent>
          </Card>

          <Nav />
        </div>
      )}
    </div>
  );
}
