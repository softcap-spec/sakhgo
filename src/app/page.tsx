"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { HeroSearch } from "@/components/hero-search";
import { QuickPicks } from "@/components/quick-picks";
import { ListingGrid } from "@/components/listing-grid";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

import { BannerSlot } from "@/components/banner-slot";

export default function HomePage() {
  const [quickPick, setQuickPick] = useState<string | null>(null);

  // Auto-expire promotions on page load
  useEffect(() => {
    // VK ID callback: refresh user state after redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has("vk_auth")) {
      import("@/lib/store").then(({ useStore }) => {
        const store = useStore.getState();
        store.fetchMe().then(() => store.setAuthOpen(false));
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete("vk_auth");
        window.history.replaceState({}, "", url.toString());
      });
    }
    import("@/lib/api").then(({ apiExpirePromotions }) => {
      apiExpirePromotions().catch(() => {});
    });
  }, []);

  return (
    <>
      <Header />
      <AuthModal />
      <main>
        <HeroSearch />
        <BannerSlot slot="home-hero-bottom" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-8" />
        <QuickPicks onPick={setQuickPick} activePick={quickPick} />
        <ListingGrid quickPick={quickPick} />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
