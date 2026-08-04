"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function CTASection() {
  const router = useRouter();

  return (
    <section className="py-24 bg-accent text-accent-fg text-center">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] mb-6">
          Разместите своё объявление на SakhGo
        </h2>
        <p className="text-accent-fg/85 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Сдавайте жильё, предлагайте туры и рыбалку или сдавайте снаряжение — наша площадка помогает найти гостей со всей России.
        </p>
        <Button size="lg" variant="secondary" className="bg-white text-accent hover:bg-white/90 text-base px-8 py-6" onClick={() => router.push("/help?section=hostInfo")}>
          Разместить объявление
        </Button>
      </div>
    </section>
  );
}
