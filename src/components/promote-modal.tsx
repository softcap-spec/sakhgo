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
  Flame, TrendingUp, Palette, Check, Zap, Star, Loader2,
} from "lucide-react";
import { apiInitPromoPayment, apiCreatePayment } from "@/lib/api";
import { useStore } from "@/lib/store";

type PromoType = "top" | "urgent" | "highlight";

const DURATIONS = [
  { value: "7",  label: "7 дней",  multiplier: 1   },
  { value: "14", label: "14 дней", multiplier: 1.8 },
  { value: "21", label: "21 день", multiplier: 2.5 },
  { value: "30", label: "30 дней", multiplier: 3.2 },
] as const;

const PROMO_OFFERS: {
  type: PromoType; label: string; desc: string;
  icon: typeof Flame; basePrice: number; color: string;
}[] = [
  {
    type:      "top",
    label:     "В ТОП",
    desc:      "Объявление закрепляется первым в каталоге и на главной. Выбирайте срок — чем дольше, тем выгоднее.",
    icon:      TrendingUp,
    basePrice: 2990,
    color:     "bg-gradient-to-r from-amber-500 to-orange-500",
  },
  {
    type:      "urgent",
    label:     "Срочно",
    desc:      "Объявление получает метку срочности и поднимается в поиске. Для горящих дат и последних мест.",
    icon:      Flame,
    basePrice: 990,
    color:     "bg-gradient-to-r from-red-500 to-rose-500",
  },
  {
    type:      "highlight",
    label:     "Выделение цветом",
    desc:      "Объявление выделяется яркой рамкой и привлекает взгляд в результатах поиска и каталоге.",
    icon:      Palette,
    basePrice: 1490,
    color:     "bg-gradient-to-r from-violet-500 to-purple-500",
  },
];

interface Props {
  listingId:    string;
  listingTitle: string;
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  currentPromo: PromoType | null;
}

export function PromoteModal({
  listingId, listingTitle, open, onOpenChange, currentPromo,
}: Props) {
  const user = useStore((s: any) => s.user);

  const [selected, setSelected] = useState<PromoType | null>(null);
  const [duration, setDuration]  = useState("7");
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState<string | null>(null);

  const calcPrice = (base: number, dur: string) => {
    const d = DURATIONS.find((x) => x.value === dur);
    return Math.round(base * (d?.multiplier ?? 1));
  };

  const handlePay = async () => {
    if (!selected || !user) return;
    setError(null);
    setLoading(true);

    const offer = PROMO_OFFERS.find((o) => o.type === selected)!;
    const price = calcPrice(offer.basePrice, duration);

    try {
      // Шаг 1: создаём / получаем запись promotions
      const initResult: any = await apiInitPromoPayment({
        listingId,
        hostId:       user.id,
        hostName:     user.name ?? "",
        listingTitle,
        promoType:    selected,
        durationDays: parseInt(duration, 10),
        price,
      });

      if (!initResult?.ok) throw new Error(initResult?.error ?? "Не удалось создать промо");
      const promotionId: string = initResult.data.id;

      // Шаг 2: создаём платёж в ЮKassa, получаем paymentUrl
      const { paymentUrl } = await apiCreatePayment(promotionId);

      // Редиректим хоста на страницу оплаты ЮKassa
      window.location.href = paymentUrl;
    } catch (err: any) {
      setError(err?.message ?? "Ошибка. Попробуйте ещё раз.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // не закрываем, пока идёт запрос
    setSelected(null);
    setDuration("7");
    setError(null);
    onOpenChange(false);
  };

  const selectedOffer = PROMO_OFFERS.find((o) => o.type === selected);
  const finalPrice    = selectedOffer ? calcPrice(selectedOffer.basePrice, duration) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Продвижение объявления</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">«{listingTitle}»</p>

        {currentPromo && (
          <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm">
            <Zap className="w-4 h-4 text-accent shrink-0" />
            <span className="text-muted-foreground">
              Активно: {PROMO_OFFERS.find((o) => o.type === currentPromo)?.label}
            </span>
          </div>
        )}

        <div className="space-y-4 pt-2">
          {PROMO_OFFERS.map((offer) => {
            const isCurrent  = currentPromo === offer.type;
            const isSelected = selected === offer.type;

            return (
              <button
                key={offer.type}
                onClick={() => { setSelected(offer.type); setDuration("7"); setError(null); }}
                disabled={loading}
                className={`w-full text-left p-4 border-2 rounded-xl transition-all disabled:opacity-50 ${
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

          {selected && (
            <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Срок размещения</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v ?? "7")} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => {
                      const p = selectedOffer ? calcPrice(selectedOffer.basePrice, d.value) : 0;
                      const savings = d.value !== "7"
                        ? Math.round(selectedOffer!.basePrice * parseInt(d.value) - p)
                        : 0;
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

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
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
            disabled={!selected || loading}
            onClick={handlePay}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Переходим к оплате…</>
            ) : (
              "Оплатить через ЮKassa"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Безопасная оплата через ЮKassa. Активация — моментально после подтверждения платежа.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
