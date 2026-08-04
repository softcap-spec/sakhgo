"use client";

import { useState, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LOCATIONS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Check, Bold, Italic, Underline, List, ListOrdered } from "lucide-react";

const AMENITY_OPTIONS = [
  "Wi-Fi", "Парковка", "Вид на горы", "Вид на море",
  "Сушилка для снаряжения/лыж", "Камин", "Баня/Сауна",
  "Кондиционер", "Стиральная машина", "Полностью оборудованная кухня",
  "Балкон/Терраса", "Мангал", "Трансфер от аэропорта", "Можно с животными",
];

interface EditListingForm {
  title: string;
  description: string;
  descriptionHtml: string;
  price: string;
  maxGuests: string;
  roomsCount: string;
  bedsCount: string;
  amenities: string[];
  location: string;
  address: string;
  season: string;
  cancellationPolicy: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function EditListingModal({
  listing,
  open,
  onOpenChange,
}: {
  listing: { id: string; title: string; price: string; location: string; hostId: string };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const store = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<EditListingForm>({
    title: listing.title,
    description: "",
    descriptionHtml: "",
    price: listing.price,
    maxGuests: "2",
    roomsCount: "1",
    bedsCount: "1",
    amenities: [],
    location: listing.location,
    address: "",
    season: "all_season",
    cancellationPolicy: "",
  });

  const update = <K extends keyof EditListingForm>(k: K, v: EditListingForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      update("descriptionHtml", editorRef.current.innerHTML);
      update("description", editorRef.current.innerText);
    }
  }, []);

  const handleSave = () => {
    if (!form.title.trim()) return;

    store.requestListingEdit({
      listingId: listing.id,
      listingTitle: listing.title,
      hostId: listing.hostId || store.user?.id || "",
      hostName: store.user?.name || "",
      changes: {
        title: form.title.trim(),
        price: form.price,
        location: form.location,
        description: form.description,
        maxGuests: form.maxGuests,
        roomsCount: form.roomsCount,
        bedsCount: form.bedsCount,
        amenities: form.amenities.join(", "),
        season: form.season,
        cancellationPolicy: form.cancellationPolicy,
        address: form.address,
      },
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Редактировать объявление</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* ── Название ── */}
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={120}
              placeholder="напр. «Квартира у СТК Горный Воздух»"
            />
          </div>

          {/* ── Цена ── */}
          <div className="space-y-2">
            <Label>Цена</Label>
            <Input
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="4 500 ₽ / ночь"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Гостей</Label>
              <Select value={form.maxGuests} onValueChange={(v) => update("maxGuests", v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,8,10,12,16,20].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Комнат</Label>
              <Select value={form.roomsCount} onValueChange={(v) => update("roomsCount", v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1","2","3","4","5+"].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Спальных мест</Label>
              <Select value={form.bedsCount} onValueChange={(v) => update("bedsCount", v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1","2","3","4","5","6","8","10+"].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Удобства ── */}
          <div className="space-y-2">
            <Label>Удобства</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    update(
                      "amenities",
                      form.amenities.includes(a)
                        ? form.amenities.filter((x) => x !== a)
                        : [...form.amenities, a]
                    )
                  }
                  className={cn(
                    "px-3 py-1.5 text-sm border rounded-full transition-colors",
                    form.amenities.includes(a)
                      ? "bg-accent text-accent-fg border-accent"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  {form.amenities.includes(a) && <Check className="w-3 h-3 inline mr-1" />}
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* ── Локация ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Локация *</Label>
              <Select value={form.location} onValueChange={(v) => update("location", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сезон</Label>
              <div className="flex gap-1">
                {[
                  { value: "all_season", label: "Всесезон" },
                  { value: "winter", label: "Зима" },
                  { value: "summer", label: "Лето" },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => update("season", s.value)}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs border rounded-lg transition-colors",
                      form.season === s.value
                        ? "border-accent bg-accent/5 font-medium"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Адрес или ориентир</Label>
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="ул. Горная, 5 / 500 м от СТК Горный Воздух"
            />
          </div>

          <Separator />

          {/* ── Rich-Text описание ── */}
          <div className="space-y-2">
            <Label>Описание</Label>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 p-1 border rounded-t-lg bg-muted/30">
              <button
                type="button"
                onClick={() => execCmd("bold")}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Жирный"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("italic")}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Курсив"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("underline")}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Подчёркнутый"
              >
                <Underline className="w-4 h-4" />
              </button>
              <span className="w-px h-5 bg-border mx-1" />
              <button
                type="button"
                onClick={() => execCmd("insertUnorderedList")}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Маркированный список"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("insertOrderedList")}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Нумерованный список"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>

            {/* Editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (editorRef.current) {
                  update("descriptionHtml", editorRef.current.innerHTML);
                  update("description", editorRef.current.innerText);
                }
              }}
              className="min-h-[120px] border border-t-0 rounded-b-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent bg-white empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
              data-placeholder="Опишите, что включено, какие условия, что с собой взять..."
            />
            <p className="text-[10px] text-muted-foreground">
              Выделите текст и нажмите кнопку форматирования. Жирный, курсив, подчёркнутый, списки.
            </p>
          </div>

          <Separator />

          {/* ── Политика отмены ── */}
          <div className="space-y-2">
            <Label>Политика отмены</Label>
            <Input
              value={form.cancellationPolicy}
              onChange={(e) => update("cancellationPolicy", e.target.value)}
              placeholder="Бесплатная отмена за 24 часа..."
            />
          </div>

          <Separator />

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Изменения отправятся на модерацию и будут видны после одобрения.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button onClick={handleSave} disabled={!form.title.trim() || saved}>
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Отправлено
                  </>
                ) : (
                  "Отправить на модерацию"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
