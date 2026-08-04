"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Flame, TrendingUp, Palette, Check, Zap, Clock, Star,
} from "lucide-react";

type PromoType = "top" | "urgent" | "highlight";

// ── Duration options shared across all promo types ──
const DURATIONS = [
  { value: "7", label: "7 дней", multiplier: 1 },
  { value: "14", label: "14 дней", multiplier: 1.8 },
  { value: "21", label: "21 день", multiplier: 2.5 },
  { value: "30", label: "30 дней", multiplier: 3.2 },
] as const;

const PROMO_OFFERS: {
  type: PromoType;
  label: string;
  desc: string;
  icon: typeof Flame;
  basePrice: number;
  color: string;
}[] = [
  {
    type: "top",
    label: "В ТОП",
    desc: "Объявление закрепляется первым в каталоге и на главной. Выбирайте срок — чем дольше, тем выгоднее.",
    icon: TrendingUp,
    basePrice: 2990,
    color: "bg-gradient-to-r from-amber-500 to-orange-500",
  },
  {
    type: "urgent",
    label: "Срочно",
    desc: "Объявление получает метку срочности и поднимается в поиске. Для горящих дат и последних мест.",
    icon: Flame,
    basePrice: 990,
    color: "bg-gradient-to-r from-red-500 to-rose-500",
  },
  {
    type: "highlight",
    label: "Выделение цветом",
    desc: "Объявление выделяется яркой рамкой и привлекает взгляд в результатах поиска и каталоге.",
    icon: Palette,
    basePrice: 1490,
    color: "bg-gradient-to-r from-violet-500 to-purple-500",
  },
];

interface Props {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (type: PromoType) => void;
  currentPromo: PromoType | null;
}

export function PromoteModal({
  listingId,
  listingTitle,
  open,
  onOpenChange,
  onApply,
  currentPromo,
}: Props) {
  const [selected, setSelected] = useState<PromoType | null>(null);
  const [duration, setDuration] = useState("7");
  const [success, setSuccess] = useState(false);

  const calcPrice = (base: number, dur: string) => {
    const d = DURATIONS.find((x) => x.value === dur);
    return Math.round(base * (d?.multiplier ?? 1));
  };

  const handleApply = () => {
    if (!selected) return;
    setSuccess(true);
    onApply(selected);
    setTimeout(() => {
      setSuccess(false);
      setSelected(null);
    }, 2000);
  };

  const handleClose = () => {
    setSelected(null);
    setDuration("7");
    setSuccess(false);
    onOpenChange(false);
  };

  const selectedOffer = PROMO_OFFERS.find((o) => o.type === selected);
  const finalPrice = selectedOffer ? calcPrice(selectedOffer.basePrice, duration) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Продвижение объявления</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          «{listingTitle}»
        </p>

        {currentPromo && !success && (
          <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm">
            <Zap className="w-4 h-4 text-accent shrink-0" />
            <span className="text-muted-foreground">
              Активно: {PROMO_OFFERS.find((o) => o.type === currentPromo)?.label}
            </span>
          </div>
        )}

        {success ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-display text-xl">Оплата прошла успешно!</h3>
            <p className="text-sm text-muted-foreground">
              {selectedOffer?.label} на {DURATIONS.find((d) => d.value === duration)?.label} активировано.
            </p>
            <Button variant="outline" onClick={handleClose}>Закрыть</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {PROMO_OFFERS.map((offer) => {
              const isCurrent = currentPromo === offer.type;
              const isSelected = selected === offer.type;
              const offerPrice = calcPrice(offer.basePrice, duration);
              const bestDeal = duration === "30" ? Math.round(offer.basePrice * 30 / 7) - offer.basePrice * DURATIONS[3].multiplier : null;

              return (
                <button
                  key={offer.type}
                  onClick={() => { setSelected(offer.type); setDuration("7"); }}
                  className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                    isSelected
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : isCurrent
                      ? "border-accent/30 bg-accent/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 ${offer.color} rounded-lg flex items-center justify-center shrink-0`}>
                      <offer.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{offer.label}</span>
                        {isCurrent && (
                          <Badge className="text-xs bg-accent text-accent-fg">Активно</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{offer.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-lg">{offer.basePrice.toLocaleString("ru-RU")} ₽</div>
                      <span className="text-xs text-muted-foreground">за 7 дн.</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Duration selector — only visible when a type is selected */}
            {selected && (
              <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Срок размещения</Label>
                  <Select value={duration} onValueChange={(v) => setDuration(v ?? "7")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => {
                        const p = selectedOffer ? calcPrice(selectedOffer.basePrice, d.value) : 0;
                        const savings = d.value !== "7" ? Math.round(selectedOffer!.basePrice * 7 * parseInt(d.value) / 7 - p) : 0;
                        return (
                          <SelectItem key={d.value} value={d.value}>
                            <span className="flex items-center justify-between w-full gap-4">
                              <span>{d.label}</span>
                              <span className="font-mono text-xs">
                                {p.toLocaleString("ru-RU")} ₽
                                {savings > 0 && (
                                  <span className="text-green-600 ml-2">(−{savings.toLocaleString("ru-RU")} ₽)</span>
                                )}
                              </span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {duration !== "7" && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <Star className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Экономия {Math.round(selectedOffer!.basePrice * parseInt(duration) - finalPrice).toLocaleString("ru-RU")} ₽
                      по сравнению с оплатой понедельно
                    </span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Итого к оплате</span>
              <span className="font-display text-xl">
                {selected ? `${finalPrice.toLocaleString("ru-RU")} ₽` : "—"}
              </span>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selected}
              onClick={handleApply}
            >
              Оплатить и активировать
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Оплата через T-Bank / Yookassa. Активация — моментально после подтверждения.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
