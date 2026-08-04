"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LISTING_LABELS } from "@/lib/data";
import { ListingType } from "@/lib/types";
import { Compass, LogOut, Menu, Shield, User, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "Всё" },
  { value: "property", label: "Жильё" },
  { value: "tour", label: "Туры" },
  { value: "fishing", label: "Рыбалка" },
  { value: "rental_gear", label: "Снаряжение" },
  { value: "car_rental", label: "Прокат авто" },
];

export function Header() {
  const store = useStore();
  const router = useRouter();
  const user = store.user;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigateTab = (value: string) => {
    setMobileOpen(false);
    store.setActiveFilter(value);
    router.push(value === "all" ? "/catalog" : `/catalog?type=${value}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
        {/* Logo */}
        <button
          onClick={() => { setMobileOpen(false); router.push("/"); }}
          className="flex items-center gap-2 shrink-0"
        >
          <img src="/logo.png" alt="СахGO" className="h-10 sm:h-12 w-auto" />
        </button>

        {/* Nav Tabs — desktop */}
        <div className="hidden md:flex items-center gap-0.5 bg-white border rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => navigateTab(tab.value)}
              className={cn(
                "px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                store.activeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Auth / User — desktop */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-accent/10 rounded-lg px-3 py-1.5 transition-colors">
                <Avatar className="w-8 h-8">
                  {(user as any).avatar_url || user.avatar ? <img src={(user as any).avatar_url || user.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : <AvatarFallback className="bg-accent text-accent-fg text-sm">{user.name[0].toUpperCase()}</AvatarFallback>}
                </Avatar>
                <span className="text-sm font-medium">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  <User className="w-4 h-4 mr-2" />Мой кабинет
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <Shield className="w-4 h-4 mr-2" />Админ-панель
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push("/")}>
                  <Compass className="w-4 h-4 mr-2" />Главная
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { store.setUser(null); router.push("/"); }}>
                  <LogOut className="w-4 h-4 mr-2" />Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => { store.setAuthMode("login"); store.setAuthOpen(true); }}>
                Войти
              </Button>
              <Button size="sm" onClick={() => { store.setAuthMode("register"); store.setAuthOpen(true); }}>
                Регистрация
              </Button>
            </>
          )}
        </div>

        {/* Mobile: hamburger + auth */}
        <div className="flex items-center gap-2 sm:hidden">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:bg-accent/10 rounded-lg p-1.5 transition-colors">
                <Avatar className="w-7 h-7">
                  {(user as any).avatar_url || user.avatar ? <img src={(user as any).avatar_url || user.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : <AvatarFallback className="bg-accent text-accent-fg text-xs">{user.name[0].toUpperCase()}</AvatarFallback>}
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  <User className="w-4 h-4 mr-2" />Мой кабинет
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <Shield className="w-4 h-4 mr-2" />Админ-панель
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { store.setUser(null); router.push("/"); }}>
                  <LogOut className="w-4 h-4 mr-2" />Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => { store.setAuthMode("login"); store.setAuthOpen(true); }}>Войти</Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} className="h-9 w-9">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 pb-4 pt-2">
          <div className="grid grid-cols-2 gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => navigateTab(tab.value)}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium rounded-lg text-left transition-colors",
                  store.activeFilter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
