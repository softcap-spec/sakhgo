"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const doSearch = () => {
    if (query.trim()) {
      router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/catalog");
    }
  };

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#E2ECF4] via-[#EAF1F6] to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(59,130,200,0.07),transparent_70%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-accent font-semibold mb-4">
              <span className="w-6 h-px bg-accent/40" />
              Маркетплейс приключений
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.5rem] leading-[1.03] tracking-tight text-foreground mb-6">
              Сахалин и Курилы —{" "}
              <em className="text-accent not-italic relative">
                ближе
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none">
                  <path d="M0,4 Q25,0 50,4 Q75,8 100,4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent/50" />
                </svg>
              </em>
              , чем кажется.
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Жильё, джип-туры, морские выходы, рыбалка и снаряжение — напрямую от местных, без посредников.
            </p>
          </div>
          <div className="hidden lg:block shrink-0">
            <img src="/hero-bear.png" alt="" className="h-52 w-auto opacity-90" />
          </div>
        </div>

        {/* Search bar */}
        <div className="max-w-3xl">
          <div className="relative group">
            {/* Glow ring */}
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-accent/10 to-accent/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />

            <div className="relative flex items-center bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.15)] transition-shadow duration-300">
              <div className="flex-1 flex items-center gap-3 px-5">
                <Search className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Квартира у моря, джип-тур, сноуборд, рыбалка..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  className="w-full h-16 bg-transparent border-0 text-lg placeholder:text-muted-foreground/40 focus:outline-none"
                />
              </div>
              <div className="p-2 pr-2">
                <Button
                  size="lg"
                  onClick={doSearch}
                  className="h-12 px-7 rounded-xl gap-2 text-base font-semibold shadow-[0_4px_14px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.25)] transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  Найти
                </Button>
              </div>
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs text-muted-foreground mr-1 self-center">Часто ищут:</span>
            {["Маяк Анива", "Джип-тур", "Сноуборд", "Квартира посуточно", "Рыбалка"].map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="px-3 py-1.5 text-xs rounded-full border border-border/60 hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
