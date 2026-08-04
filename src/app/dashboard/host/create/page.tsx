"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";
import CreateListingWizard from "@/components/create-listing-wizard";
import { ArrowLeft } from "lucide-react";

export default function CreateListingPage() {
  const store = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!store.user) router.push("/");
  }, [store.user, router]);

  if (!store.user) return null;

  return (
    <>
      <Header />
      <AuthModal />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push("/dashboard/host")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Назад в кабинет
        </button>
        <h1 className="font-display text-3xl mb-10">Новое объявление</h1>
        <CreateListingWizard />
      </main>
      <Footer />
    </>
  );
}
