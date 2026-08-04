"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface QuickPick {
  id: string;
  label: string;
  count: number;
  coverImage: string | null;
  bg: string;
}

const BG_MAP: Record<string, string> = {
  mountain: "bg-gradient-to-br from-[#D4DFE7] via-[#8FB8CC] to-[#4A8BA8]",
  sea: "bg-gradient-to-br from-[#C5D5E0] via-[#7BA4BC] to-[#3B7599]",
  jeep: "bg-gradient-to-br from-[#DDD6C8] via-[#B5A68E] to-[#8C7B62]",
  fishing: "bg-gradient-to-br from-[#B8D8D8] via-[#70A8A0] to-[#387870]",
  car_rental: "bg-gradient-to-br from-[#C8D4DE] via-[#7098AE] to-[#306078]",
};

const FALLBACK_PICKS: QuickPick[] = [
  { id: "mountain", label: "Жильё", count: 0, coverImage: null, bg: BG_MAP.mountain },
  { id: "sea", label: "Морские выходы", count: 0, coverImage: null, bg: BG_MAP.sea },
  { id: "jeep", label: "Джип-туры", count: 0, coverImage: null, bg: BG_MAP.jeep },
  { id: "fishing", label: "Рыбалка", count: 0, coverImage: null, bg: BG_MAP.fishing },
];

const VISIBLE = 4;    // show 4 cards at a time
const INTERVAL = 5000; // rotate every 5 seconds

interface Props {
  onPick: (id: string) => void;
  activePick: string | null;
}

export function QuickPicks({ onPick, activePick }: Props) {
  const [picks, setPicks] = useState<QuickPick[]>(FALLBACK_PICKS);
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { apiGetQuickPickCounts } = await import("@/lib/api");
        const data = (await apiGetQuickPickCounts()) as { id: string; label: string; count: number; coverImage: string | null }[];
        setPicks(
          data.map((d) => ({
            ...d,
            coverImage: d.coverImage ?? null,
            bg: BG_MAP[d.id] || "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400",
          }))
        );
      } catch { /* ignore — keep fallback */ }
    })();
  }, []);

  // Auto-rotate through picks
  const total = picks.length;
  const maxOffset = Math.max(0, total - VISIBLE);

  useEffect(() => {
    if (maxOffset <= 0 || isPaused) return;
    const id = setInterval(() => {
      setOffset((prev) => (prev >= maxOffset ? 0 : prev + 1));
    }, INTERVAL);
    return () => clearInterval(id);
  }, [maxOffset, isPaused]);

  const visible = picks.slice(offset, offset + VISIBLE);

  // If fewer than VISIBLE picks, show what we have (no rotation needed)
  if (picks.length <= VISIBLE) {
    return (
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs uppercase tracking-[0.12em] text-accent font-medium">Быстрые подборки</span>
          <h2 className="font-display text-4xl mt-1 mb-8">Куда поедем?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {picks.map((pick) => <PickCard key={pick.id} pick={pick} activePick={activePick} onPick={onPick} />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-accent font-medium">Быстрые подборки</span>
            <h2 className="font-display text-4xl mt-1">Куда поедем?</h2>
          </div>
          {/* Dots indicator */}
          {maxOffset > 0 && (
            <div
              className="flex gap-2"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {Array.from({ length: maxOffset + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setOffset(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === offset ? "bg-accent w-4" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Слайд ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {visible.map((pick) => (
            <PickCard key={pick.id} pick={pick} activePick={activePick} onPick={onPick} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PickCard({ pick, activePick, onPick }: { pick: QuickPick; activePick: string | null; onPick: (id: string) => void }) {
  return (
    <button
      onClick={() => onPick(pick.id)}
      className={cn(
        "relative rounded-xl overflow-hidden min-h-[200px] flex items-end text-left border transition-all hover:-translate-y-0.5",
        activePick === pick.id ? "ring-2 ring-accent ring-offset-2" : "border-border"
      )}
    >
      <div className={cn("absolute inset-0", !pick.coverImage && pick.bg)} />
      {pick.coverImage && (
        <img src={pick.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/5 pointer-events-none" />
      <div className="relative z-10 p-5 text-white">
        <span className="text-xs uppercase tracking-widest opacity-75">{pick.count} вариантов</span>
        <h3 className="font-display text-xl mt-0.5 leading-tight">{pick.label}</h3>
      </div>
    </button>
  );
}
