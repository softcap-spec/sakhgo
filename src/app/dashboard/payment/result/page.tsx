"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Footer } from "@/components/footer";

export default function PaymentResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<"success" | "fail" | "checking">("checking");

  useEffect(() => {
    if (!orderId) {
      setStatus("fail");
      setChecking(false);
      return;
    }
    // Check promotion status every 2s for up to 30s
    let attempts = 0;
    const maxAttempts = 15;
    const checkStatus = async () => {
      try {
        const { apiGetMyPromotions } = await import("@/lib/api");
        // Use getAllPromotions or a simpler check
        const resp = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getPromotionStatus", promotionId: orderId }),
        });
        const data = await resp.json();
        if (data.ok && data.status === "active") {
          setStatus("success");
          setChecking(false);
          return;
        }
        if (data.ok && data.status === "cancelled") {
          setStatus("fail");
          setChecking(false);
          return;
        }
      } catch {}
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 2000);
      } else {
        setStatus("fail");
        setChecking(false);
      }
    };
    checkStatus();
  }, [orderId]);

  return (
    <>
      <Header />
      <AuthModal />
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md w-full text-center">
          {checking && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto border-4 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-zinc-400">Проверяем статус оплаты...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center text-4xl">
                ✅
              </div>
              <h1 className="text-2xl font-bold text-white">Оплата прошла!</h1>
              <p className="text-zinc-400">Продвижение активировано. Ваше объявление теперь видно большему числу пользователей.</p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition"
              >
                В личный кабинет
              </Link>
            </div>
          )}

          {status === "fail" && (
            <div className="space-y-6">
              <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center text-4xl">
                ❌
              </div>
              <h1 className="text-2xl font-bold text-white">Оплата не прошла</h1>
              <p className="text-zinc-400">
                {orderId
                  ? "Платёж не был завершён. Вы можете попробовать снова в личном кабинете."
                  : "Не указан номер заказа."}
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition"
              >
                В личный кабинет
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
