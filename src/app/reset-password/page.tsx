"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, XCircle } from "lucide-react";
import { apiResetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError("Недействительная или отсутствующая ссылка для сброса пароля.");
  }, [token]);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    setLoading(true);
    try {
      await apiResetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push("/"), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сменить пароль. Ссылка может быть просрочена.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-card border rounded-xl p-6 shadow-sm">
          {success ? (
            <div className="text-center py-4">
              <ShieldCheck className="mx-auto mb-3 text-green-500" size={48} />
              <h1 className="text-xl font-bold mb-2">Пароль изменён!</h1>
              <p className="text-sm text-muted-foreground">
                Сейчас вы будете перенаправлены на главную страницу.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Новый пароль</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Придумайте новый пароль для вашего аккаунта.
              </p>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">
                  <XCircle size={16} />
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Новый пароль</Label>
                  <Input
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!token}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Подтвердите пароль</Label>
                  <Input
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={!token}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={loading || !token}
                >
                  {loading ? "Сохранение..." : "Сохранить пароль"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
