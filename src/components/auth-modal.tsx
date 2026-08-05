"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Phone, User, CheckCircle, ShieldCheck } from "lucide-react";

const RU_PHONE_REGEX = /^(\+7|8)\d{10}$/;
const RU_PHONE_PLACEHOLDER = "+7 999 123-45-67";

const VK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077FF">
    <path d="M22.9 16.3c-.3-1.1-.8-2-1.4-2.8-.6-.8-.9-1.4-1.1-1.8-.2-.5-.1-.8.3-1.3.4-.4 1.5-1.7 2.3-2.8.9-1.1 1.2-2.1.6-2.8l-3.1-.1c-.7 0-1.3.2-1.7.6-.4.4-.9 1-1.3 1.7-.7 1.2-1.5 2.3-2.1 2.3-.4 0-.6-.1-.8-.6-.2-.4-.2-1.1-.2-1.9 0-2 .1-3.5-.9-4.5C13.9.7 13 0 11.5 0H7.1C6.2 0 5.4.6 5.1 1.5c0 0-1 4.3 4.3 9.1C11 12 14 14 16.2 15c1.7.8 3.1.7 4.2.6 1.2-.1 2.3-.9 2.5 1.7v-1z" />
  </svg>
);

/** Formats digits as user types — always starts with +7, auto-formats */
function formatPhoneInput(value: string): string {
  // Extract digits only
  const digits = value.replace(/\D/g, "");
  // If user typed 8 first, treat it as +7
  let d = digits.startsWith("8") ? digits.slice(1) : digits;
  // If user typed 7 first (from +7), strip the leading 7
  if (d.startsWith("7")) d = d.slice(1);
  // Take at most 10 digits after the country code
  d = d.slice(0, 10);
  if (d.length === 0) return "+7 ";
  let result = "+7 ";
  // Apply formatting: 3-3-2-2 groups
  if (d.length <= 3) { result += d; }
  else if (d.length <= 6) { result += d.slice(0, 3) + " " + d.slice(3); }
  else if (d.length <= 8) { result += d.slice(0, 3) + " " + d.slice(3, 6) + "-" + d.slice(6); }
  else { result += d.slice(0, 3) + " " + d.slice(3, 6) + "-" + d.slice(6, 8) + "-" + d.slice(8, 10); }
  return result;
}

export function AuthModal() {
  const store = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "forgot">(store.authMode);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("+7 ");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [regError, setRegError] = useState("");

  const validatePhone = (raw: string): boolean => {
    const digits = raw.replace(/\D/g, "");
    // Normalise: strip leading 7 or 8, should leave exactly 10 digits
    let d = digits;
    if (d.startsWith("7")) d = d.slice(1);
    else if (d.startsWith("8")) d = d.slice(1);
    if (d.length !== 10) {
      setPhoneError("Введите номер полностью — 10 цифр после +7");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const [loading, setLoading] = useState(false);

  // Verification state
  const [verificationStep, setVerificationStep] = useState<"none" | "show-code" | "enter-code">("none");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setForgotError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 email"); return; }
    setLoading(true); setForgotError("");
    try {
      const ok = await store.forgotPassword(forgotEmail.trim());
      if (ok) { setForgotSent(true); }
      else { setForgotError("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 email."); }
    } catch { setForgotError("\u041e\u0448\u0438\u0431\u043a\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435."); }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPass.trim()) return;
    setLoading(true);
    setRegError("");
    try {
      const user = await store.login(loginEmail.trim(), loginPass.trim());
      if (!user) {
        setRegError("Неверный email или пароль.");
        return;
      }
      if (user.role !== "admin") { setRegError("Доступ запрещён. Только для администраторов."); store.logout(); return; }
      store.setAuthOpen(false);
      reset();
      await store.loadFromDb();
      router.push("/dashboard");
    } catch {
      setRegError("Ошибка входа. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegError("");
    if (!regName.trim()) { setRegError("Укажите имя"); return; }
    if (!validatePhone(regPhone)) return;
    if (!regEmail.trim()) { setRegError("Укажите email"); return; }
    if (regPass.length < 6) { setRegError("Пароль минимум 6 символов"); return; }

    const digits = regPhone.replace(/\D/g, "");
    let d = digits;
    if (d.startsWith("8")) d = d.slice(1);
    if (d.startsWith("7")) d = d.slice(1);
    const normalizedPhone = "+7" + d;

    setLoading(true);
    try {
      const user = await store.register(regName.trim(), regEmail.trim(), normalizedPhone, regPass);
      if (!user) { setRegError("Не удалось зарегистрироваться. Проверьте email и телефон на занятость."); setLoading(false); return; }
      
      // Generate verification code and show it
      setRegisteredEmail(regEmail.trim());
      try {
        const code = await store.generateVerificationCode(regEmail.trim());
        if (code) {
          setVerificationCode(code);
          setVerificationStep("show-code");
        } else {
          // Skip verification if generation fails
          store.setAuthOpen(false);
          reset();
          await store.loadFromDb();
          router.push("/dashboard");
        }
      } catch {
        store.setAuthOpen(false);
        reset();
        await store.loadFromDb();
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Email")) setRegError("Этот email уже зарегистрирован");
      else if (msg.includes("телефон") || msg.includes("phone")) setRegError("Этот номер телефона уже зарегистрирован");
      else setRegError("Ошибка регистрации. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoginEmail(""); setLoginPass("");
    setRegName(""); setRegPhone("+7 "); setRegEmail(""); setRegPass("");
    setPhoneError(""); setRegError("");
    setMode(store.authMode);
    setVerificationStep("none");
    setVerificationCode("");
    setVerificationInput("");
    setVerificationError("");
    setVerificationSuccess(false);
    setRegisteredEmail("");
  };

  const handleVerifyCode = async () => {
    if (verificationInput.length !== 6) {
      setVerificationError("Введите 6-значный код");
      return;
    }
    setLoading(true);
    setVerificationError("");
    try {
      const ok = await store.verifyPhone(registeredEmail, verificationInput);
      if (ok) {
        setVerificationSuccess(true);
        setTimeout(() => {
          store.setAuthOpen(false);
          reset();
          store.loadFromDb();
          router.push("/dashboard");
        }, 1500);
      } else {
        setVerificationError("Неверный код. Попробуйте ещё раз.");
      }
    } catch {
      setVerificationError("Ошибка проверки. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipVerification = () => {
    store.setAuthOpen(false);
    reset();
    store.loadFromDb();
    router.push("/dashboard");
  };

  return (
    <Dialog
      open={store.authOpen}
      onOpenChange={(v) => { store.setAuthOpen(v); if (!v) reset(); }}
    >
      <DialogContent className="sm:max-w-md">
        {/* Verification Step */}
        {verificationStep !== "none" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-accent" />
                Подтверждение телефона
              </DialogTitle>
            </DialogHeader>

            {verificationSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-14 h-14 mx-auto mb-3 text-success" />
                <p className="font-display text-2xl text-success">Телефон подтверждён ✓</p>
                <p className="text-sm text-muted-foreground mt-2">Перенаправляем в личный кабинет...</p>
              </div>
            ) : (
              <div className="space-y-5 pt-2">
                {verificationStep === "show-code" && (
                  <>
                    <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Ваш код подтверждения:</p>
                      <div className="font-mono text-4xl font-bold tracking-[0.3em] text-accent">
                        {verificationCode}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Введите этот код ниже для подтверждения номера телефона.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setVerificationStep("enter-code")}
                    >
                      Ввести код
                    </Button>
                  </>
                )}

                {verificationStep === "enter-code" && (
                  <>
                    <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">Код подтверждения:</p>
                      <div className="font-mono text-3xl font-bold tracking-[0.2em] text-accent mt-1">
                        {verificationCode}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Введите код</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={verificationInput}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setVerificationInput(v);
                          setVerificationError("");
                        }}
                        className={cn("text-center font-mono text-xl tracking-[0.3em]", verificationError && "border-destructive")}
                      />
                      {verificationError && <p className="text-xs text-destructive text-center">{verificationError}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleVerifyCode} disabled={loading || verificationInput.length !== 6}>
                        {loading ? "Проверка..." : "Подтвердить"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setVerificationStep("show-code")}>
                        Назад
                      </Button>
                    </div>
                  </>
                )}

                <div className="text-center pt-1">
                  <button
                    onClick={handleSkipVerification}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Подтвердить позже
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {mode === "login" ? "Войти" : "Регистрация"}
              </DialogTitle>
            </DialogHeader>

            {mode === "forgot" ? (
              <div className="space-y-4 pt-2">
                {forgotSent ? (
                  <div className="text-center py-6">
                    <CheckCircle className="mx-auto mb-3 text-green-500" size={40} />
                    <p className="font-medium text-lg mb-1">Ссылка отправлена</p>
                    <p className="text-sm text-muted-foreground mb-4">Проверьте почту {forgotEmail}. Ссылка действительна 1 час.</p>
                    <button onClick={() => { setMode("login"); setForgotSent(false); }} className="text-accent font-medium hover:underline text-sm">Вернуться ко входу</button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Введите email, и мы отправим ссылку для сброса пароля.</p>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="ivan@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                    </div>
                    {forgotError && <p className="text-sm text-red-500">{forgotError}</p>}
                    <Button className="w-full" onClick={handleForgot} disabled={loading}>{loading ? "Отправка..." : "Отправить ссылку"}</Button>
                    <button onClick={() => setMode("login")} className="text-sm text-accent font-medium hover:underline block text-center w-full">← Вернуться ко входу</button>
                  </>
                )}
              </div>
            ) : mode === "login" ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="ivan@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Пароль</Label>
                  <Input type="password" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleLogin} disabled={loading}>{loading ? "Вход..." : "Войти"}</Button>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">или</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={() => router.push("/api/auth/vk/login")}>
                  {VK_ICON}
                  Войти через VK ID
                </Button>
                <button onClick={() => { setMode("forgot"); setForgotSent(false); setForgotError(""); }} className="text-sm text-muted-foreground hover:text-accent block text-center w-full mb-2">Забыли пароль?</button>
                <p className="text-center text-sm text-muted-foreground">
                  Нет аккаунта?{" "}
                  <button onClick={() => setMode("register")} className="text-accent font-medium hover:underline">
                    Зарегистрироваться
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input placeholder="Иван Петров" value={regName} onChange={(e) => setRegName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    Телефон <span className="text-destructive">*</span>
                    <span className="text-[10px] text-muted-foreground font-normal ml-auto">только РФ</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder={RU_PHONE_PLACEHOLDER}
                    value={regPhone}
                    onChange={(e) => { setPhoneError(""); setRegPhone(formatPhoneInput(e.target.value)); }}
                    className={cn(phoneError && "border-destructive")}
                  />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                  <p className="text-[10px] text-muted-foreground">Регистрация только для российских номеров.</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="ivan@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Пароль</Label>
                  <Input type="password" placeholder="минимум 6 символов" value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                </div>

                {regError && <p className="text-sm text-destructive text-center">{regError}</p>}
                <Button className="w-full" onClick={handleRegister} disabled={loading}>{loading ? "Регистрация..." : "Зарегистрироваться"}</Button>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">или</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={() => router.push("/api/auth/vk/login")}>
                  {VK_ICON}
                  Войти через VK ID
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Уже есть аккаунт?{" "}
                  <button onClick={() => setMode("login")} className="text-accent font-medium hover:underline">
                    Войти
                  </button>
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
