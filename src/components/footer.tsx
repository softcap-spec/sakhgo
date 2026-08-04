"use client";

import { useRouter } from "next/navigation";

export function Footer() {
  const router = useRouter();

  return (
    <footer className="border-t py-10 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="СахGO" className="h-12 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Маркетплейс туруслуг, рыбалки и жилья для Сахалинской области и Курильских островов.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-[0.1em] text-muted mb-4 font-medium">Разделы</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <button onClick={() => router.push("/catalog?type=property")} className="hover:text-foreground transition-colors text-left block">Жильё посуточно</button>
              <button onClick={() => router.push("/catalog?type=tour")} className="hover:text-foreground transition-colors text-left block">Туры и экскурсии</button>
              <button onClick={() => router.push("/catalog?type=fishing")} className="hover:text-foreground transition-colors text-left block">Рыбалка</button>
              <button onClick={() => router.push("/catalog?type=rental_gear")} className="hover:text-foreground transition-colors text-left block">Аренда снаряжения</button>
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-[0.1em] text-muted mb-4 font-medium">Помощь</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <button onClick={() => router.push("/help?section=howItWorks")} className="hover:text-foreground transition-colors text-left block">Как это работает</button>
              <button onClick={() => router.push("/help?section=faq")} className="hover:text-foreground transition-colors text-left block">Частые вопросы</button>
              <button onClick={() => router.push("/help?section=cancelPolicy")} className="hover:text-foreground transition-colors text-left block">Политика отмены</button>
              <button onClick={() => router.push("/help?section=support")} className="hover:text-foreground transition-colors text-left block">Поддержка</button>
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-[0.1em] text-muted mb-4 font-medium">Партнёрам</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <button onClick={() => router.push("/help?section=hostInfo")} className="hover:text-foreground transition-colors text-left block">Разместить объявление</button>
              <button onClick={() => router.push("/help?section=faq")} className="hover:text-foreground transition-colors text-left block">Продвижение</button>
              <button onClick={() => router.push("/help?section=rules")} className="hover:text-foreground transition-colors text-left block">Правила площадки</button>
            </div>
          </div>
        </div>
        <div className="border-t pt-6 flex flex-wrap justify-between gap-4 text-xs text-muted font-mono tracking-wider">
          <span>© 2026 SakhGo · Сахалинская область</span>
          <span className="flex gap-4">
            <button onClick={() => router.push("/help?section=privacy")} className="hover:text-foreground transition-colors">Конфиденциальность</button>
            <span className="text-border">·</span>
            <button onClick={() => router.push("/help?section=terms")} className="hover:text-foreground transition-colors">Условия</button>
          </span>
        </div>
      </div>
    </footer>
  );
}
