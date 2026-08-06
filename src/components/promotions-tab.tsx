"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DollarSign, TrendingUp, CheckCircle, XCircle, Edit2, Save, Ban,
  RefreshCw, Zap, BarChart3, Eye, MousePointer, Users, ShoppingBag, Trash2,
} from "lucide-react";

interface Promotion {
  id: string;
  listing_id: string;
  host_id: string;
  host_name: string;
  listing_title: string;
  promo_type: "top" | "highlight" | "urgent";
  duration_days: number;
  price: number;
  status: string;
  impressions: number;
  clicks: number;
  contacts: number;
  bookings_from_promo: number;
  revenue: number;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  listing_type?: string;
  location?: string;
}

interface PromoPricing {
  promo_type: string;
  base_price_7d: number;
  base_price_14d: number;
  base_price_21d: number;
  base_price_30d: number;
  enabled: boolean;
}

interface PromoStats {
  total: number;
  active: number;
  paid: number;
  pending: number;
  cancelled: number;
  total_impressions: number;
  total_clicks: number;
  total_contacts: number;
  total_bookings: number;
  total_revenue: number;
  monthly_revenue?: { month: string; revenue: number; count: number }[];
}

const PROMO_LABELS: Record<string, string> = { top: "ТОП", highlight: "Выделение", urgent: "Срочно" };
const PROMO_COLORS: Record<string, string> = {
  top: "bg-amber-100 text-amber-700",
  highlight: "bg-violet-100 text-violet-700",
  urgent: "bg-rose-100 text-rose-700",
};
const STATUS_BADGES: Record<string, { c: string; l: string }> = {
  pending: { c: "bg-yellow-100 text-yellow-700", l: "Ожидает" },
  paid: { c: "bg-blue-100 text-blue-700", l: "Оплачен" },
  active: { c: "bg-green-100 text-green-700", l: "Активен" },
  expired: { c: "bg-gray-100 text-gray-600", l: "Истёк" },
  refunded: { c: "bg-red-100 text-red-700", l: "Возврат" },
  cancelled: { c: "bg-red-100 text-red-700", l: "Отменён" },
};

export function PromotionsTab() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [pricing, setPricing] = useState<PromoPricing[]>([]);
  const [stats, setStats] = useState<PromoStats>({
    total: 0, active: 0, paid: 0, pending: 0, cancelled: 0,
    total_impressions: 0, total_clicks: 0, total_contacts: 0, total_bookings: 0, total_revenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editPrices, setEditPrices] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { d7: string; d14: string; d21: string; d30: string; enabled: boolean }>>({});
  const [view, setView] = useState<"list" | "pricing">("list");

  const loadData = async (pg = page) => {
    setLoading(true);
    const { apiGetAllPromotions, apiGetPromoPricing, apiGetPromoStats } = await import("@/lib/api");
    const [p, pr, s] = await Promise.all([
      apiGetAllPromotions(pg, 15).catch(() => ({ items: [], total: 0, page: 1, pageSize: 15, totalPages: 1 })),
      apiGetPromoPricing().catch(() => []),
      apiGetPromoStats().catch(() => null),
    ]);
    const items = Array.isArray(p?.items) ? p.items : Array.isArray(p) ? p : [];
    // Fallback: if page is empty but there are items total, reload page 1
    if (items.length === 0 && p?.total > 0 && pg > 1) {
      setPage(1);
      loadData(1);
      return;
    }
    setPromos(items);
    if (p?.total !== undefined) setTotal(p.total);
    if (p?.totalPages !== undefined) setTotalPages(p.totalPages);
    setPricing(Array.isArray(pr) ? pr : []);
    if (s) setStats(s);
    setLoading(false);
  };

  useEffect(() => { loadData(1); }, []);

  const changePage = (pg: number) => { setPage(pg); loadData(pg); };

  const openPriceEditor = () => {
    const drafts: Record<string, { d7: string; d14: string; d21: string; d30: string; enabled: boolean }> = {};
    pricing.forEach((pp) => {
      drafts[pp.promo_type] = {
        d7: String(pp.base_price_7d),
        d14: String(pp.base_price_14d),
        d21: String(pp.base_price_21d),
        d30: String(pp.base_price_30d),
        enabled: pp.enabled,
      };
    });
    setPriceDrafts(drafts);
    setEditPrices(true);
  };

  const savePrices = async () => {
    const { apiUpdatePromoPricing } = await import("@/lib/api");
    for (const [type, vals] of Object.entries(priceDrafts)) {
      await apiUpdatePromoPricing(type, {
        base_price_7d: parseInt(vals.d7) || 0,
        base_price_14d: parseInt(vals.d14) || 0,
        base_price_21d: parseInt(vals.d21) || 0,
        base_price_30d: parseInt(vals.d30) || 0,
        enabled: vals.enabled,
      }).catch(() => {});
    }
    setEditPrices(false);
    loadData(page);
  };

  const updateStatus = async (id: string, status: string) => {
    const { apiUpdatePromotionStatus } = await import("@/lib/api");
    await apiUpdatePromotionStatus(id, status).catch(() => {});
    loadData(page);
  };

  const deletePromotion = async (id: string, title: string) => {
    if (!confirm(`Удалить продвижение «${title}»?`)) return;
    const { apiDeletePromotion } = await import("@/lib/api");
    await apiDeletePromotion(id).catch(() => {});
    setPage(1);
    loadData(1);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;

  const pricingForType = (t: string) => pricing.find((p) => p.promo_type === t);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Продвижение и монетизация</h2>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            <BarChart3 className="w-4 h-4 mr-1" /> Заказы
          </Button>
          <Button variant={view === "pricing" ? "default" : "outline"} size="sm" onClick={() => setView("pricing")}>
            <DollarSign className="w-4 h-4 mr-1" /> Цены
          </Button>
        </div>
      </div>

      {/* Stats cards — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {[
          { l: "Доход", v: `${stats.total_revenue.toLocaleString("ru-RU")} ₽`, i: DollarSign, c: "text-green-600" },
          { l: "Всего", v: String(stats.total), i: ShoppingBag, c: "text-blue-600" },
          { l: "Активных", v: String(stats.active), i: Zap, c: "text-amber-600" },
          { l: "Показы", v: stats.total_impressions.toLocaleString(), i: Eye, c: "text-violet-600" },
          { l: "Контакты", v: String(stats.total_contacts), i: Users, c: "text-cyan-600" },
        ].map((s) => (
          <div key={s.l} className="bg-card border rounded-xl p-3">
            <s.i className={cn("w-4 h-4 mb-1.5", s.c)} />
            <div className="font-display text-xl">{s.v}</div>
            <div className="text-[11px] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>


      {/* Monthly Revenue Breakdown */}
      {stats.monthly_revenue && stats.monthly_revenue.length > 0 && (
        <div className="bg-card border rounded-xl p-4 mb-8">
          <h3 className="font-display text-sm text-muted-foreground mb-3">Выручка по месяцам</h3>
          <div className="space-y-2">
            {stats.monthly_revenue.map((m: { month: string; revenue: number; count: number }) => {
              const maxRev = Math.max(...stats.monthly_revenue!.map((x: { revenue: number }) => x.revenue));
              const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
              const [y, mo] = m.month.split("-");
              const label = new Date(parseInt(y), parseInt(mo)-1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">{label}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono w-24 shrink-0">{m.revenue.toLocaleString("ru-RU")} ₽</span>
                  <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">{m.count} шт.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {view === "pricing" ? (
        /* ── Pricing Editor ── */
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">Тарифы продвижения</h3>
            {!editPrices ? (
              <Button size="sm" variant="outline" onClick={openPriceEditor}><Edit2 className="w-3.5 h-3.5 mr-1" /> Изменить</Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={savePrices}><Save className="w-3.5 h-3.5 mr-1" /> Сохранить</Button>
                <Button size="sm" variant="outline" onClick={() => setEditPrices(false)}><Ban className="w-3.5 h-3.5 mr-1" /> Отмена</Button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {(["top", "highlight", "urgent"] as const).map((type) => {
              const pp = editPrices ? priceDrafts[type] : pricingForType(type);
              if (!pp) return null;
              return (
                <div key={type} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className={cn("text-xs font-semibold", PROMO_COLORS[type])}>{PROMO_LABELS[type]}</Badge>
                    {editPrices ? (
                      <Label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input type="checkbox" checked={pp.enabled} onChange={(e) => setPriceDrafts(d => ({ ...d, [type]: { ...d[type], enabled: e.target.checked } }))} className="w-3.5 h-3.5" />
                        Включён
                      </Label>
                    ) : (
                      <Badge variant="secondary" className={cn("text-xs", pp.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {pp.enabled ? "Активен" : "Отключён"}
                      </Badge>
                    )}
                  </div>
                  {editPrices ? (
                    <div className="grid grid-cols-4 gap-3">
                      {(["d7","d14","d21","d30"] as const).map((k) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{k === "d7" ? "7 дн." : k === "d14" ? "14 дн." : k === "d21" ? "21 дн." : "30 дн."}</Label>
                          <Input value={(pp as any)[k]} onChange={(e) => setPriceDrafts(d => ({ ...d, [type]: { ...d[type], [k]: e.target.value } }))} className="h-8 text-sm" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div><span className="text-muted-foreground">7 дн.:</span> <span className="font-mono font-semibold">{("d7" in pp ? (pp as any).d7 : (pp as PromoPricing).base_price_7d)} ₽</span></div>
                      <div><span className="text-muted-foreground">14 дн.:</span> <span className="font-mono font-semibold">{("d14" in pp ? (pp as any).d14 : (pp as PromoPricing).base_price_14d)} ₽</span></div>
                      <div><span className="text-muted-foreground">21 дн.:</span> <span className="font-mono font-semibold">{("d21" in pp ? (pp as any).d21 : (pp as PromoPricing).base_price_21d)} ₽</span></div>
                      <div><span className="text-muted-foreground">30 дн.:</span> <span className="font-mono font-semibold">{("d30" in pp ? (pp as any).d30 : (pp as PromoPricing).base_price_30d)} ₽</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Promotions List ── */
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Хост</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Объявление</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Тип</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Сумма</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Показы</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Клики</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Срок</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.host_name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{p.listing_title}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge className={cn("text-xs font-semibold", PROMO_COLORS[p.promo_type])}>
                        {PROMO_LABELS[p.promo_type]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs">{p.price.toLocaleString("ru-RU")} ₽</td>
                    <td className="px-3 py-3 text-center font-mono text-xs hidden sm:table-cell">{p.impressions}</td>
                    <td className="px-3 py-3 text-center font-mono text-xs hidden sm:table-cell">{p.clicks}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge className={cn("text-xs", STATUS_BADGES[p.status]?.c || "bg-gray-100")}>
                        {STATUS_BADGES[p.status]?.l || p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground hidden md:table-cell">
                      {formatDate(p.started_at)} – {formatDate(p.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {p.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(p.id, "active")}>Активировать</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => updateStatus(p.id, "cancelled")}>Отклонить</Button>
                          </>
                        )}
                        {p.status === "active" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => updateStatus(p.id, "refunded")}>Возврат</Button>
                        )}
                        {p.status === "paid" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(p.id, "active")}>Активировать</Button>
                        )}
                        {(p.status === "expired" || p.status === "refunded" || p.status === "cancelled") && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deletePromotion(p.id, p.listing_title)} title="Удалить">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {promos.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Нет оплаченных продвижений</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {total} всего · стр. {page} из {totalPages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => changePage(page - 1)}>Назад</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Вперёд</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
