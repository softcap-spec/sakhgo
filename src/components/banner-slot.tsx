"use client";

import { useEffect, useRef } from "react";
import { useStore, Banner } from "@/lib/store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const SLOT_LABELS: Record<Banner["slot"], string> = {
  "home-hero-bottom": "Главная — под поиском",
  "catalog-sidebar": "Каталог — боковая панель",
  "listing-detail-bottom": "Карточка объявления — низ",
  "search-results-top": "Результаты поиска — верх",
};

interface BannerSlotProps {
  slot: Banner["slot"];
  className?: string;
}

function HtmlBanner({ html, linkUrl, bannerId }: { html: string; linkUrl: string; bannerId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = html;
    // Make clickable if linkUrl is set
    if (linkUrl) {
      const el = ref.current;
      el.style.cursor = "pointer";
      const handler = () => {
        useStore.getState().updateBanner(bannerId, {
          clicks: (useStore.getState().banners.find(b => b.id === bannerId)?.clicks ?? 0) + 1,
        });
        if (linkUrl.startsWith("http")) {
          window.open(linkUrl, "_blank", "noopener");
        } else {
          router.push(linkUrl);
        }
      };
      el.addEventListener("click", handler);
      return () => el.removeEventListener("click", handler);
    }
  }, [html, linkUrl, bannerId, router]);

  return <div ref={ref} />;
}

export function BannerSlot({ slot, className }: BannerSlotProps) {
  const banners = useStore((s) => s.banners);
  const router = useRouter();
  const active = banners.filter((b) => b.slot === slot && b.active);

  if (active.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {active.map((b) => (
        <BannerItem key={b.id} banner={b} router={router} />
      ))}
    </div>
  );
}

function BannerItem({ banner: b, router }: { banner: Banner; router: ReturnType<typeof useRouter> }) {
  if (b.htmlContent) {
    return (
      <div className="relative group rounded-lg overflow-hidden border bg-card hover:ring-2 hover:ring-accent/30 transition-all">
        <BannerTracker bannerId={b.id} impressions={b.impressions} />
        <HtmlBanner html={b.htmlContent} linkUrl={b.linkUrl} bannerId={b.id} />
        <span className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Реклама</span>
      </div>
    );
  }

  return (
    <div
      className="relative group cursor-pointer rounded-lg overflow-hidden border bg-card hover:ring-2 hover:ring-accent/30 transition-all"
      onClick={() => {
        useStore.getState().updateBanner(b.id, { clicks: b.clicks + 1 });
        if (b.linkUrl.startsWith("http")) {
          window.open(b.linkUrl, "_blank", "noopener");
        } else {
          router.push(b.linkUrl);
        }
      }}
    >
      <BannerTracker bannerId={b.id} impressions={b.impressions} />
      {b.imageUrl ? (
        <img
          src={b.imageUrl}
          alt={b.title}
          className="w-full h-auto object-cover"
          style={{ minHeight: b.slot === "home-hero-bottom" ? 90 : b.slot === "catalog-sidebar" ? 120 : 60 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-accent/5 text-muted-foreground text-sm p-4"
          style={{ minHeight: b.slot === "home-hero-bottom" ? 90 : b.slot === "catalog-sidebar" ? 120 : 60 }}
        >
          <div className="text-center">
            <p className="font-display text-accent text-lg">{b.title}</p>
            <p className="text-xs mt-1">Реклама</p>
          </div>
        </div>
      )}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
        Реклама
      </div>
    </div>
  );
}

function BannerTracker({ bannerId, impressions }: { bannerId: string; impressions: number }) {
  useEffect(() => {
    const key = `banner-imp-${bannerId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      useStore.getState().updateBanner(bannerId, { impressions: impressions + 1 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export { SLOT_LABELS };
