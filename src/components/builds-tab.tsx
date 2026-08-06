"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, Rocket } from "lucide-react";

interface BuildEntry {
  id?: number;
  version: string;
  date: string;
  description: string;
  changes: string[];
  hash: string;
}

const FALLBACK_HISTORY: BuildEntry[] = [
  {
    version: "1.6.0", date: "2026-08-05", hash: "9057667",
    description: "Монетизация: ЮKassa + реальные платежи за продвижение",
    changes: [
      "Полная цепочка монетизации: заявка → платёж ЮKassa → активация",
      "lib/yookassa.ts: initYooKassaPayment + проверка вебхуков",
      "Новая страница /dashboard/payment/result — статус оплаты",
    ],
  },
  {
    version: "1.5.0", date: "2026-08-05", hash: "35beb9d",
    description: "Восстановление пароля + VK ID аутентификация",
    changes: [
      "Модалка входа: режим «Забыли пароль?», отправка ссылки на email",
      "Страница /reset-password: сброс пароля по токену из URL",
      "VK: PKCE (code_verifier + code_challenge SHA-256), callback → createSession",
    ],
  },
  {
    version: "1.0.0", date: "2026-07-30", hash: "e5f6g7h",
    description: "Первый публичный билд",
    changes: [
      "Маркетплейс: жильё, туры, рыбалка, снаряжение, прокат авто",
      "Каталог, карточки объявлений, страница объявления",
      "Личный кабинет: создание и управление объявлениями",
    ],
  },
];

export function BuildsTab() {
  const [builds, setBuilds] = useState<BuildEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBuilds = async () => {
    setLoading(true);
    const { apiGetBuilds } = await import("@/lib/api");
    const r = (await apiGetBuilds()) as any;
    if (r?.builds && r.builds.length > 0) {
      setBuilds(r.builds);
    }
    setLoading(false);
  };

  useEffect(() => { loadBuilds(); }, []);

  const history = builds.length > 0 ? builds : FALLBACK_HISTORY;

  if (loading) return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">История сборок</h2>
        <div className="flex items-center gap-3">
          <Badge className="text-sm px-3 py-1">
            {history.length} сборок
          </Badge>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-8">
          {history.map((build, idx) => (
            <div key={`${build.version}-${build.hash}`} className="relative pl-12">
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
                  {build.changes.map((change: string, ci: number) => (
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
        <p>v{history[0].version} · Собрано {history[0].date} · Хэш {history[0].hash}</p>
        <p className="mt-1">Сервер: 192.168.85.87 · HTTPS (Let's Encrypt) · Next.js + PostgreSQL · PM2</p>
      </div>
    </div>
  );
}
