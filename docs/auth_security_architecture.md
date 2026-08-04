# SakhalinStay · Auth & Security Architecture

> **Версия:** 1.0  
> **Дата:** 2026-07-29  
> **Цель:** Замена демо-аутентификации на production-grade Supabase Auth + полный security-слой

---

## Содержание

1. [Текущее состояние (As-Is)](#1-текущее-состояние-as-is)
2. [Целевая архитектура (To-Be)](#2-целевая-архитектура-to-be)
3. [Auth Flow Diagram](#3-auth-flow-diagram)
4. [Middleware Logic](#4-middleware-logic)
5. [RLS Policy List per Table](#5-rls-policy-list-per-table)
6. [Registration Flow with Role Assignment](#6-registration-flow-with-role-assignment)
7. [Admin Access Control Mechanism](#7-admin-access-control-mechanism)
8. [Client Security](#8-client-security)
9. [Session Handling](#9-session-handling)
10. [Storage Security](#10-storage-security)
11. [File-by-File Changes](#11-file-by-file-changes)
12. [Migration Plan](#12-migration-plan)

---

## 1. Текущее состояние (As-Is)

### 1.1 Auth: Demo-only

| Компонент | Проблема |
|-----------|----------|
| `auth-modal.tsx` | Принимает любой email/пароль, создаёт `{ id: "demo-1"/"demo-2" }` без реальной проверки |
| `header.tsx` | Читает `store.user`, но это localStorage-заглушка |
| `store.ts` | `AuthUser` лежит в Zustand persist → localStorage. Нет связи с Supabase Session |
| `admin/page.tsx` | `useEffect + setTimeout(100ms)` хардкодит админ-логин `alex@example.com` |
| `supabase.ts` | Клиент создан, но нигде не используется для auth |

### 1.2 Security: Отсутствует

| Слой | Статус |
|------|--------|
| Route protection | ❌ Нет `middleware.ts` — все маршруты открыты |
| Database RLS | ❌ Нет миграций, таблицы не созданы |
| Input validation | ❌ Wizard-формы не санитизируют ввод |
| CSRF | ❌ Нет явной настройки |
| Rate limiting | ❌ Нет на API маршрутах |
| Session management | ❌ localStorage-only, нет server-side проверки |
| Storage security | ❌ Нет конфигурации Supabase Storage |

---

## 2. Целевая архитектура (To-Be)

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ AuthModal     │  │ Header       │  │ Dashboard Pages       │ │
│  │ (supabase     │  │ (reads       │  │ (protected routes)    │ │
│  │  signIn/      │  │  supabase    │  │                       │ │
│  │  signUp)      │  │  session)    │  │                       │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                       │             │
│         └────────┬────────┴───────────────────────┘             │
│                  │                                              │
│         ┌────────▼────────┐                                    │
│         │  Supabase JS    │  (cookie-based session)            │
│         │  Client         │                                    │
│         └────────┬────────┘                                    │
└──────────────────┼──────────────────────────────────────────────┘
                   │  HTTPS
┌──────────────────┼──────────────────────────────────────────────┐
│           Next.js Server                                         │
│                  │                                               │
│   ┌──────────────▼──────────────┐                               │
│   │  middleware.ts               │  (runs on every request)     │
│   │  ┌────────────────────────┐  │                               │
│   │  │ 1. Refresh session     │  │  (supabase SSR client)       │
│   │  │ 2. Check /admin/*      │  │  → role must be "admin"      │
│   │  │ 3. Check /dashboard/*  │  │  → must be authenticated     │
│   │  │ 4. Inject session user │  │  → request headers/cookies  │
│   │  └────────────────────────┘  │                               │
│   └──────────────┬──────────────┘                               │
│                  │                                               │
│   ┌──────────────▼──────────────┐                               │
│   │  API Routes                  │                               │
│   │  /api/auth/*                 │  (health/status)             │
│   │  /api/bookings/*             │  (rate-limited, RLS-backed)  │
│   │  /api/listings/*             │  (CRUD with RLS)             │
│   │  /api/payments/webhook       │  (IP-whitelist + HMAC)       │
│   │  /api/upload/*               │  (Supabase Storage proxy)    │
│   └──────────────────────────────┘                               │
│                                                                  │
│   ┌──────────────────────────────┐                               │
│   │  Server Components           │                               │
│   │  (can read session via       │                               │
│   │   cookies() + supabase SSR)  │                               │
│   └──────────────────────────────┘                               │
└──────────────────────┼───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                      Supabase Cloud                               │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │ Auth Service │  │ Postgres DB  │  │ Storage (S3-compat)   │   │
│  │             │  │              │  │                        │   │
│  │ • signUp    │  │ • profiles   │  │ • listing-images/     │   │
│  │ • signIn    │  │ • listings   │  │ • avatars/            │   │
│  │ • signOut   │  │ • bookings   │  │   (RLS-protected)     │   │
│  │ • verifyOtp │  │ • promotions │  │ • size limits: 10MB   │   │
│  │ • OAuth     │  │ • categories │  │ • mime whitelist      │   │
│  └─────────────┘  └──────────────┘  └────────────────────────┘   │
│                          │                                        │
│                   ┌──────▼──────┐                                 │
│                   │  RLS Engine  │  (row-level security)          │
│                   │              │                                 │
│                   │  Every table │  has policies                   │
│                   │  auth.uid()  │  is the universal filter       │
│                   └─────────────┘                                 │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Auth Stack

| Слой | Технология | Назначение |
|------|-----------|-----------|
| Identity Provider | Supabase Auth | Email/Password + OAuth (Google, Yandex) |
| Server-side session | `@supabase/ssr` cookies | middleware + server components |
| Client-side session | `@supabase/ssr` browser client | RSC payload, real-time |
| Route guard | Next.js `middleware.ts` | Protect `/admin/*`, `/dashboard/*`, `/api/*` |
| State management | Zustand (light) | UI state only (activeFilter, favorites, authOpen), **NOT** auth user anymore |
| Database auth | Supabase RLS | Row-level security for all CRUD |

### 2.3 Environment Variables

```env
# .env.local (development only — NEVER commit)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Admin
ADMIN_EMAIL=alexander@sakhalinstay.ru      # hardcoded admin identity
ADMIN_ALLOWED_IPS=                         # optional: comma-separated IP whitelist

# Security
CSRF_SECRET=                               # optional: custom CSRF signing secret
RATE_LIMIT_BOOKING_RPM=10                  # bookings per minute per IP
RATE_LIMIT_UPLOAD_RPM=20                   # uploads per minute per user

# Payments
T_BANK_WEBHOOK_SECRET=                     # HMAC secret for T-Bank signature verification
YOOKASSA_SHOP_SECRET=                      # Yookassa webhook secret
```

---

## 3. Auth Flow Diagram

### 3.1 Registration Flow

```
User clicks "Регистрация" in header
        │
        ▼
AuthModal opens in "register" mode
        │
        ▼
User selects role: [Путешественник] или [Организатор]
        │
        ▼
User fills: name, email, password
        │
        ▼
Client calls: supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name, role }    ← role stored in user_metadata
  }
})
        │
        ▼
Supabase sends verification email
        │
        ▼
User clicks verification link
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Database Trigger: on_auth_user_created            │
│                                                   │
│ INSERT INTO profiles (id, full_name, email, role) │
│ VALUES (                                          │
│   NEW.id,                                         │
│   NEW.raw_user_meta_data->>'full_name',           │
│   NEW.email,                                      │
│   NEW.raw_user_meta_data->>'role'                 │
│ );                                                │
└───────────────────────────────────────────────────┘
        │
        ▼
User is redirected to site → automatically logged in
        │
        ▼
middleware.ts reads session → allows /dashboard/* access
        │
        ▼
Dashboard shows role-appropriate content
```

### 3.2 Login Flow

```
User clicks "Войти" in header
        │
        ▼
AuthModal opens in "login" mode
        │
        ▼
User enters email + password
        │
        ▼
Client calls: supabase.auth.signInWithPassword({ email, password })
        │
        ▼
    ┌───────┴───────┐
    │               │
    ▼               ▼
SUCCESS          FAILURE
    │               │
    ▼               ▼
session set     Show error
in cookies      "Неверный email или пароль"
    │
    ▼
middleware reads session → routes user appropriately
    │
    ├── /admin/*     → check role === "admin"
    ├── /dashboard/* → role determines which dashboard
    └── /            → public with user info in header
```

### 3.3 Logout Flow

```
User clicks "Выйти" in header dropdown
        │
        ▼
Client calls: supabase.auth.signOut()
        │
        ▼
Supabase: deletes session cookie + server-side session
        │
        ▼
Zustand: clear UI state (favorites, authOpen, etc.)
        │
        ▼
router.push("/") → redirect to home
        │
        ▼
middleware: no session → public access only
```

### 3.4 OAuth Flow (Google / Yandex)

```
User clicks "Войти через Google" in AuthModal
        │
        ▼
supabase.auth.signInWithOAuth({ provider: "google" })
        │
        ▼
Redirect to Google consent screen
        │
        ▼
User authorizes → redirect back to /auth/callback
        │
        ▼
┌───────────────────────────────────────────────────┐
│ /auth/callback/route.ts (Next.js route handler)   │
│                                                   │
│ const code = searchParams.get("code")             │
│ await supabase.auth.exchangeCodeForSession(code)  │
│                                                   │
│ // If new user, trigger profile creation          │
│ // (handled by DB trigger on_auth_user_created)   │
│                                                   │
│ redirect("/dashboard/traveler")                   │
└───────────────────────────────────────────────────┘
```

---

## 4. Middleware Logic

### 4.1 File: `src/middleware.ts`

```typescript
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── 1. Create Supabase SSR client with cookie management ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── 2. Refresh session (important: do NOT use getUser — use getSession for middleware) ──
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  const path = request.nextUrl.pathname;

  // ── 3. Admin route protection ──
  if (path.startsWith("/admin")) {
    if (!user) {
      // Not authenticated → redirect to login
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirect", path);
      url.searchParams.set("error", "admin_auth_required");
      return NextResponse.redirect(url);
    }

    // Fetch role from DB (not JWT — JWT claims may be stale)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      // Authenticated but not admin → 403
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("error", "admin_access_denied");
      return NextResponse.redirect(url);
    }

    // Optional: IP whitelist for admin
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(",").map((s) => s.trim()) ?? [];
    if (allowedIPs.length > 0) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (!allowedIPs.includes(ip)) {
        return new NextResponse("Forbidden: IP not whitelisted for admin access", {
          status: 403,
        });
      }
    }
  }

  // ── 4. Dashboard / protected route protection ──
  const protectedPaths = [
    "/dashboard",
    "/api/bookings",
    "/api/listings",
    "/api/upload",
    "/api/profile",
  ];

  const isProtected = protectedPaths.some((prefix) => path.startsWith(prefix));

  if (isProtected) {
    if (!user) {
      // API routes → return 401 JSON
      if (path.startsWith("/api")) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        );
      }
      // Page routes → redirect to login
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
  }

  // ── 5. Add user info to request headers for downstream use ──
  if (user) {
    supabaseResponse.headers.set("x-user-id", user.id);
    supabaseResponse.headers.set("x-user-email", user.email ?? "");
  }

  return supabaseResponse;
}

// ── 6. Matcher config: which paths trigger middleware ──
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public/ (public assets)
     * - auth callback (OAuth redirect)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|auth/callback).*)",
  ],
};
```

### 4.2 Middleware Decision Matrix

| Path Pattern | No Session | Session (traveler/host) | Session (admin) |
|-------------|-----------|------------------------|-----------------|
| `/` (home) | ✅ Allow | ✅ Allow | ✅ Allow |
| `/catalog` | ✅ Allow | ✅ Allow | ✅ Allow |
| `/listings/[id]` | ✅ Allow | ✅ Allow | ✅ Allow |
| `/help` | ✅ Allow | ✅ Allow | ✅ Allow |
| `/dashboard/traveler` | 🔴 Redirect to `/` | ✅ Allow (traveler only) | 🔴 Redirect to `/admin` |
| `/dashboard/host` | 🔴 Redirect to `/` | ✅ Allow (host/vendor only) | 🔴 Redirect to `/admin` |
| `/dashboard/host/create` | 🔴 Redirect to `/` | ✅ Allow (host/vendor only) | 🔴 Redirect to `/admin` |
| `/admin` | 🔴 Redirect to `/` | 🔴 403 | ✅ Allow |
| `/api/bookings/*` | 🔴 401 JSON | ✅ Allow | ✅ Allow |
| `/api/listings/*` | 🔴 401 JSON | ✅ Allow (host) | ✅ Allow |
| `/api/payments/webhook` | 🔴 401 JSON | 🔴 403 | ✅ Allow |
| `/api/upload/*` | 🔴 401 JSON | ✅ Allow (host) | ✅ Allow |

---

## 5. RLS Policy List per Table

### 5.1 Schema: `auth.users` (managed by Supabase)

Не трогаем — управляется Supabase автоматически. Доступ к `auth.users` есть только у сервисного ключа.

### 5.2 Table: `profiles`

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone can read any profile (public info like name, avatar)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- INSERT: Users can only insert their own profile (trigger does this)
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile ONLY
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- UPDATE: Admins can update any profile (role changes, ban, verify)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: No one can delete profiles (soft-delete via is_active flag instead)
-- (No DELETE policy = denied by default)
```

### 5.3 Table: `listings`

```sql
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone can read active, verified listings
CREATE POLICY "Active listings are publicly viewable"
  ON listings FOR SELECT
  USING (is_active = true AND is_verified = true);

-- SELECT: Hosts can see their own listings (including unverified)
CREATE POLICY "Hosts can view own listings"
  ON listings FOR SELECT
  USING (host_id = auth.uid());

-- SELECT: Admins can view all listings
CREATE POLICY "Admins can view all listings"
  ON listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Only hosts/vendors can create listings
CREATE POLICY "Hosts can create listings"
  ON listings FOR INSERT
  WITH CHECK (
    host_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('host', 'vendor', 'admin')
    )
  );

-- UPDATE: Hosts can update own listings
CREATE POLICY "Hosts can update own listings"
  ON listings FOR UPDATE
  USING (host_id = auth.uid());

-- UPDATE: Admins can update any listing (moderation: verify/reject)
CREATE POLICY "Admins can update any listing"
  ON listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Only admin can delete (hosts can deactivate instead)
CREATE POLICY "Admins can delete listings"
  ON listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 5.4 Table: `bookings`

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: Guests see own bookings, Hosts see bookings on their listings
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    guest_id = auth.uid()
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Authenticated users can create bookings
CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    guest_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND is_active = true AND is_verified = true
    )
  );

-- UPDATE: Guest can cancel own booking; Host can confirm/reject
CREATE POLICY "Guest can cancel own booking"
  ON bookings FOR UPDATE
  USING (guest_id = auth.uid())
  WITH CHECK (guest_id = auth.uid() AND status IN ('cancelled'));

CREATE POLICY "Host can confirm/reject booking"
  ON bookings FOR UPDATE
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid() AND status IN ('confirmed', 'rejected'));

-- UPDATE: Admin can change any booking status
CREATE POLICY "Admin can update any booking"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: No one deletes bookings (archival via status = 'cancelled')
```

### 5.5 Table: `promotions`

```sql
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- SELECT: Host sees own promotions; Admin sees all
CREATE POLICY "Users can view own promotions"
  ON promotions FOR SELECT
  USING (
    host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Host can create promotions for own listings
CREATE POLICY "Hosts can create promotions"
  ON promotions FOR INSERT
  WITH CHECK (
    host_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND host_id = auth.uid() AND is_active = true
    )
  );

-- UPDATE: Admin can change payment status (webhook handler)
CREATE POLICY "Admin can update promotions"
  ON promotions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypasses RLS for webhook handler
-- (Use supabase admin client with service_role key in /api/payments/webhook)
```

### 5.6 Table: `categories`

```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- SELECT: Public read
CREATE POLICY "Categories are publicly viewable"
  ON categories FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE: Admin only
CREATE POLICY "Admin can manage categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 5.7 RLS Summary Card

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Public | Self (trigger) | Self + Admin | ❌ Denied |
| `listings` | Active+Verified / Own / Admin | Host+Vendor+Admin | Own / Admin | Admin only |
| `bookings` | Guest+Host+Admin | Auth users | Guest cancel / Host confirm+reject / Admin all | ❌ Denied |
| `promotions` | Own+Admin | Host (own listing) | Admin (webhook) | ❌ Denied |
| `categories` | Public | Admin | Admin | Admin |

---

## 6. Registration Flow with Role Assignment

### 6.1 UI Flow (auth-modal.tsx changes)

Registration now has THREE role buttons instead of two:

```
┌─────────────────────────────────────────┐
│           Регистрация                     │
│                                           │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐ │
│  │ 🧳      │  │ 🏠      │  │ 🎣       │ │
│  │ Traveler│  │ Host    │  │ Vendor   │ │
│  │         │  │         │  │          │ │
│  │ Бронирую│  │ Размещаю│  │ Сдаю     │ │
│  │ жильё   │  │ жильё   │  │ снаряж.  │ │
│  └─────────┘  └─────────┘  └──────────┘ │
│                                           │
│  Email: [________________]               │
│  Пароль: [________________]              │
│                                           │
│  ┌──────────────────────────┐            │
│  │ Зарегистрироваться        │            │
│  └──────────────────────────┘            │
└─────────────────────────────────────────┘
```

### 6.2 Registration Code Flow

```typescript
// In auth-modal.tsx - register handler
const handleRegister = async () => {
  // 1. Client-side validation
  if (!email.trim() || !password.trim() || password.length < 8) {
    setError("Пароль должен быть не менее 8 символов");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError("Некорректный формат email");
    return;
  }

  // 2. Supabase signUp with role in user_metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim(),
        role: selectedRole,      // "traveler" | "host" | "vendor"
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    setError(error.message);
    return;
  }

  // 3. Show verification notice
  setShowVerificationSent(true);
  // "Проверьте почту — мы отправили ссылку для подтверждения email"
};
```

### 6.3 Database Trigger (SQL Migration)

```sql
-- Run in Supabase SQL Editor

-- Function: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'traveler'),
    FALSE,  -- starts unverified; set to true after email confirmation
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Trigger: fire after user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function: mark profile verified when email is confirmed
CREATE OR REPLACE FUNCTION public.handle_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET is_verified = TRUE, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_email_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_verified();
```

### 6.4 Role Guard in Middleware (Dashboard Routing)

```typescript
// In middleware.ts — after session refresh

// Route user to correct dashboard based on role
if (path === "/dashboard" || path === "/dashboard/") {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "admin":
      return NextResponse.redirect(new URL("/admin", request.url));
    case "host":
    case "vendor":
      return NextResponse.redirect(new URL("/dashboard/host", request.url));
    case "traveler":
    default:
      return NextResponse.redirect(new URL("/dashboard/traveler", request.url));
  }
}

// Prevent travelers from accessing host dashboard
if (path.startsWith("/dashboard/host")) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "traveler") {
    return NextResponse.redirect(new URL("/dashboard/traveler", request.url));
  }
}
```

---

## 7. Admin Access Control Mechanism

### 7.1 Identity: Hardcoded Admin Email

```
ADMIN_EMAIL=alexander@sakhalinstay.ru
```

- Only this email can be admin
- Admin identity is tied to a **specific Supabase user account**
- The `role = 'admin'` in `profiles` table is set manually via Supabase SQL Editor (one-time)
- Middleware checks `profiles.role === 'admin'` on every `/admin/*` request
- Admin email is never exposed client-side — only used server-side in middleware + env

### 7.2 Admin Provisions Flow

```
┌────────────────────────────────────────────────────────────┐
│  Initial Setup (one-time)                                   │
│                                                             │
│  1. Admin registers normally via signUp with email          │
│     alexander@sakhalinstay.ru                               │
│                                                             │
│  2. Admin's profile is created by DB trigger with            │
│     role = 'traveler' (default)                             │
│                                                             │
│  3. In Supabase SQL Editor, manually run:                   │
│     UPDATE profiles                                         │
│     SET role = 'admin'                                      │
│     WHERE email = 'alexander@sakhalinstay.ru';              │
│                                                             │
│  4. Admin now passes middleware check:                      │
│     profile.role === 'admin' → access /admin/*              │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Admin Login (Separate from Regular Flow)

The admin uses the SAME login form, but:

1. Admin enters credentials in standard AuthModal
2. `supabase.auth.signInWithPassword()` authenticates
3. Middleware on `/admin` route checks `profiles.role === 'admin'`
4. If true → allow; if false → 403 redirect to home

**The admin never auto-logs in.** The old `useEffect + setTimeout` hardcoded-login hack is removed entirely.

### 7.4 Admin Security Hardening

| Measure | Implementation |
|---------|---------------|
| **IP Whitelist** | `ADMIN_ALLOWED_IPS=192.168.1.100,203.0.113.5` in `.env` — middleware checks `x-forwarded-for` header |
| **Session timeout** | Supabase default: JWT expires after 1 hour. Admin sessions get refreshed by middleware on each request |
| **Role re-check** | Every `/admin/*` request verifies `profiles.role` from DB (not from cached JWT) |
| **Audit log** | Future: log all admin actions to `admin_audit_log` table |

### 7.5 Admin Audit Log Table (Future)

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,            -- e.g., 'approve_listing', 'ban_user', 'change_role'
  target_type TEXT,                -- 'listing', 'booking', 'user', 'content'
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only admins can read audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert audit entries"
  ON admin_audit_log FOR INSERT
  WITH CHECK (true);  -- service_role bypass
```

---

## 8. Client Security

### 8.1 Input Sanitization on Wizard Forms

The `create-listing-wizard.tsx` accepts free-text input in 15+ fields. All must be sanitized:

```typescript
// src/lib/sanitize.ts

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
];

/**
 * Strip HTML tags and dangerous content from user input.
 * Use before storing in DB or rendering.
 */
export function sanitizeInput(input: string, maxLength: number = 5000): string {
  if (!input) return "";

  let sanitized = input;

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove XSS patterns
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Trim and limit length
  sanitized = sanitized.trim().slice(0, maxLength);

  return sanitized;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Sanitize numeric price input
 */
export function sanitizePrice(input: string): number | null {
  const num = parseInt(input.replace(/[^\d]/g, ""), 10);
  return isNaN(num) || num <= 0 ? null : Math.min(num, 10_000_000); // max 10M RUB
}

/**
 * Validate allowed enum values
 */
export function validateEnum<T extends string>(
  value: string,
  allowed: readonly T[]
): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}
```

**Where sanitization is applied:**

| Component | Fields | Method |
|-----------|--------|--------|
| `auth-modal.tsx` | email, name, password | `validateEmail`, `sanitizeInput` |
| `create-listing-wizard.tsx` | title, description, address, policies, etc. | `sanitizeInput` |
| API routes | All request body fields | Zod validation (see below) |

### 8.2 Zod Validation on API Routes

```typescript
// src/lib/validations.ts
import { z } from "zod";

export const CreateListingSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  listing_type: z.enum(["property", "tour", "fishing", "rental_gear"]),
  category_id: z.string().uuid().optional(),
  price_per_night: z.number().int().positive().max(10_000_000),
  location_tag: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  max_guests: z.number().int().min(1).max(100),
  amenities: z.array(z.string().max(50)).max(30).optional(),
  images: z.array(z.string().url()).min(1).max(10),
});

export const CreateBookingSchema = z.object({
  listing_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests_count: z.number().int().min(1).max(50),
  guest_message: z.string().max(1000).optional(),
});

// Used in API route:
// const parsed = CreateListingSchema.safeParse(await request.json());
// if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
```

### 8.3 Rate Limiting on Booking API

```typescript
// src/lib/rate-limit.ts
import { LRUCache } from "lru-cache"; // or use a simple Map with TTL

interface RateLimitOptions {
  interval: number;  // milliseconds
  maxRequests: number;
}

const rateLimitCache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10_000,
  ttl: 60_000,
});

export function rateLimit(
  key: string,
  options: RateLimitOptions = { interval: 60_000, maxRequests: 10 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(key, { count: 1, resetAt: now + options.interval });
    return { allowed: true, remaining: options.maxRequests - 1, resetAt: now + options.interval };
  }

  if (entry.count >= options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  rateLimitCache.set(key, entry);
  return { allowed: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Usage in API route:
// const ip = request.headers.get("x-forwarded-for") ?? "unknown";
// const { allowed, remaining, resetAt } = rateLimit(ip, {
//   interval: 60_000,
//   maxRequests: parseInt(process.env.RATE_LIMIT_BOOKING_RPM ?? "10"),
// });
// if (!allowed) {
//   return NextResponse.json(
//     { error: "Too many requests", retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
//     { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
//   );
// }
```

### 8.4 CSRF Protection

Next.js 16 App Router provides built-in CSRF protection via:

1. **Server Actions** use `Next-CSRF-Token` header automatically
2. **API Routes** with `POST/PUT/DELETE` are protected by Origin/Referer header checks (Next.js default)
3. **Additional hardening:**

```typescript
// src/middleware.ts — CSRF check for API routes
const csrfProtectedPaths = ["/api/bookings", "/api/listings", "/api/upload"];

if (csrfProtectedPaths.some((p) => path.startsWith(p))) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Block requests without proper Origin header
  if (origin && host) {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }
}
```

---

## 9. Session Handling

### 9.1 Session Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Session Lifecycle                                        │
│                                                           │
│  1. Login/Register                                        │
│     supabase.auth.signInWithPassword() / signUp()         │
│     → Supabase sets HTTP-only cookie:                     │
│       sb-{ref}-auth-token                                 │
│                                                           │
│  2. Every Request                                         │
│     middleware.ts creates Supabase SSR client             │
│     → reads cookies from request                          │
│     → supabase.auth.getSession()                          │
│     → if expired, Supabase automatically refreshes token  │
│     → new cookies set via response                        │
│                                                           │
│  3. Client-side State                                     │
│     Zustand stores NO auth user                           │
│     Auth user derived from supabase.auth.getUser()        │
│     on each client mount or auth state change             │
│                                                           │
│  4. Logout                                                │
│     supabase.auth.signOut()                               │
│     → clears all cookies                                  │
│     → clears Zustand UI state                             │
│     → redirect to /                                       │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Zustand Store Restructure

The Zustand store is reduced to **UI-only state**. Auth user is managed by Supabase:

```typescript
// src/lib/store.ts — REFACTORED

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  // Auth UI only — no user object stored here
  authOpen: boolean;
  authMode: "login" | "register";

  // App state
  activeFilter: string;
  favorites: string[];

  // Actions
  setAuthOpen: (v: boolean) => void;
  setAuthMode: (m: "login" | "register") => void;
  setActiveFilter: (f: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useStore = create<UIState>()(
  persist(
    (set, get) => ({
      authOpen: false,
      authMode: "login",
      activeFilter: "all",
      favorites: [],

      setAuthOpen: (v) => set({ authOpen: v }),
      setAuthMode: (m) => set({ authMode: m }),
      setActiveFilter: (f) => set({ activeFilter: f }),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),
      isFavorite: (id) => get().favorites.includes(id),
    }),
    {
      name: "sakhalinstay-ui",
      partialize: (state) => ({
        favorites: state.favorites,
        activeFilter: state.activeFilter,
      }),
    }
  )
);
```

**Bookings and listings data moves to React Query + Supabase:**

```typescript
// src/lib/hooks/use-auth.ts — NEW HOOK
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  }

  return {
    user,       // Supabase User object
    profile,    // DB profile row (with role)
    loading,
    isAdmin: profile?.role === "admin",
    isHost: profile?.role === "host" || profile?.role === "vendor",
  };
}
```

### 9.3 Proper Signout

```typescript
// In header.tsx or any logout handler
const handleSignOut = async () => {
  await supabase.auth.signOut();
  // supabase.onAuthStateChange will fire → useAuth hook updates
  // No need to manually set user = null
  router.push("/");
  router.refresh(); // force server re-render with new cookies
};
```

---

## 10. Storage Security

### 10.1 Supabase Storage Bucket Configuration

```sql
-- Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('listing-images', 'listing-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/avif']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('documents', 'documents', false, 5242880, ARRAY['application/pdf']);
```

### 10.2 Storage RLS Policies

```sql
-- listing-images: Public read, Host write own
CREATE POLICY "Anyone can view listing images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

CREATE POLICY "Hosts can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('host', 'vendor', 'admin')
    )
  );

CREATE POLICY "Hosts can delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- avatars: Public read, Self write
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- documents: Protected — only owner + admin can access
CREATE POLICY "Owners can access own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
```

### 10.3 Upload Security

| Layer | Protection |
|-------|-----------|
| **File size** | Bucket-level limit: 10MB images, 2MB avatars |
| **MIME type** | Bucket-level whitelist: JPEG, PNG, WebP, AVIF |
| **Virus scanning** | Mentioned in terms; implement via Supabase Edge Function calling ClamAV or VirusTotal API before storage |
| **Client-side check** | `file.size <= 10MB`, `file.type` starts with `image/` |
| **Server-side re-check** | API route validates before proxy-upload to Supabase Storage |
| **Signed URLs** | Use `supabase.storage.from('listing-images').createSignedUrl(path, 3600)` for protected downloads |
| **Rate limit** | `RATE_LIMIT_UPLOAD_RPM=20` per user per minute |

---

## 11. File-by-File Changes

### 11.1 New Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Session refresh, route protection, admin guard, CSRF |
| `src/lib/sanitize.ts` | Input sanitization utilities |
| `src/lib/validations.ts` | Zod schemas for API routes |
| `src/lib/rate-limit.ts` | In-memory rate limiter (LRU cache) |
| `src/lib/hooks/use-auth.ts` | `useAuth()` hook — replaces store.user |
| `src/lib/hooks/use-bookings.ts` | React Query hook for bookings (Supabase) |
| `src/lib/hooks/use-listings.ts` | React Query hook for listings (Supabase) |
| `src/lib/hooks/use-profile.ts` | React Query hook for profile CRUD |
| `src/app/auth/callback/route.ts` | OAuth callback handler |
| `src/app/auth/confirm/route.ts` | Email verification redirect handler |
| `supabase/migrations/00001_rls_policies.sql` | All RLS policies |
| `supabase/migrations/00002_triggers.sql` | Profile creation + email verification triggers |
| `supabase/migrations/00003_storage_buckets.sql` | Storage buckets + RLS |
| `docs/AUTH_SECURITY_ARCHITECTURE.md` | This document |

### 11.2 Modified Files

| File | Changes |
|------|---------|
| **`src/lib/store.ts`** | Remove `user`, `bookings`, `myListings`, all booking/listing actions. Keep only UI state: `authOpen`, `authMode`, `activeFilter`, `favorites`. Remove `persist` for anything except `favorites` and `activeFilter`. |
| **`src/lib/supabase.ts`** | Add SSR client export for server use. Keep browser client for client components. Add service-role client for webhooks. |
| **`src/lib/types.ts`** | No changes needed — Profile, Listing, Booking types already match DB schema |
| **`src/components/auth-modal.tsx`** | Replace demo handlers with real `supabase.auth.signUp()` / `supabase.auth.signInWithPassword()`. Add email verification notice, error states, OAuth buttons (Google), loading states. Add `vendor` role option. Add password strength validation. |
| **`src/components/header.tsx`** | Replace `store.user` with `useAuth()` hook. Use `profile?.role` for dashboard routing. Use `profile?.full_name` for display. Proper signOut via `supabase.auth.signOut()`. |
| **`src/components/providers.tsx`** | Wrap with `AuthProvider` context that initializes `useAuth` at app root. |
| **`src/app/layout.tsx`** | Import and render `<AuthProvider>` around children. |
| **`src/app/admin/page.tsx`** | **REMOVE** `useEffect` auto-login hack entirely. Replace `store.user` with `useAuth()`. Add loading state while middleware/session is resolving. The middleware handles the auth check — if the user reaches this page, they are authenticated as admin. |
| **`src/app/dashboard/host/page.tsx`** | Replace `store.user` with `useAuth()`. Replace `store.bookings`/`store.myListings` with React Query hooks backed by Supabase. |
| **`src/app/dashboard/host/create/page.tsx`** | Replace `store.user.role` check with `useAuth()`. Sanitize wizard output before storing. |
| **`src/app/dashboard/traveler/page.tsx`** | Replace `store.user` with `useAuth()`. Replace `store.bookings` with React Query hooks. |
| **`src/app/catalog/page.tsx`** | Replace `store.user` with `useAuth()` for favorites display. |
| **`src/app/listings/[id]/page.tsx`** | Replace any `store.user` references with `useAuth()`. |
| **`src/app/help/page.tsx`** | Minimal changes — just `useAuth()` for header auth state. |
| **`src/components/create-listing-wizard.tsx`** | Apply `sanitizeInput` to all text fields before storing. Add Zod validation before submit. Upload images to Supabase Storage instead of demo stubs. |
| **`src/components/promote-modal.tsx`** | Connect to Supabase promotions table. |
| **`src/lib/api-hooks.ts`** | Replace mock data with real Supabase queries. Remove demo delay. Use proper typing. |
| **`src/app/api/payments/webhook/route.ts`** | Add service-role Supabase client. Add webhook signature verification (HMAC). Add rate limiting. Uncomment DB update logic. |
| **`.env.local`** | Add `ADMIN_EMAIL`, `ADMIN_ALLOWED_IPS`, `RATE_LIMIT_*`, webhook secrets |
| **`.gitignore`** | Ensure `.env.local` is listed (already standard in Next.js) |

### 11.3 Supabase Client File — Expanded

```typescript
// src/lib/supabase.ts — EXPANDED

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — for client components */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Service-role client — for webhooks & server-only operations (bypasses RLS) */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** SSR helper — for middleware & server components */
export function createSSRClient(
  cookieStore: {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options: CookieOptions) => void;
    remove: (name: string, options: CookieOptions) => void;
  }
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.keys(cookieStore).map((name) => ({
          name,
          value: cookieStore.get(name) ?? "",
        }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}
```

---

## 12. Migration Plan

### Phase 1: Foundation (Week 1)

**Day 1-2: Supabase Setup**
- [ ] Create Supabase project (or use existing)
- [ ] Run migration `00001_rls_policies.sql` on Supabase SQL Editor
- [ ] Run migration `00002_triggers.sql`
- [ ] Verify `profiles` trigger works by manually creating a test user
- [ ] Create test admin account with `alexander@sakhalinstay.ru`
- [ ] Set `ADMIN_EMAIL` in `.env.local`

**Day 3-4: Core Auth**
- [ ] Create `src/middleware.ts` with session refresh + route protection
- [ ] Create `src/lib/hooks/use-auth.ts`
- [ ] Rewrite `auth-modal.tsx` with real Supabase signUp / signIn
- [ ] Add OAuth callback route `src/app/auth/callback/route.ts`
- [ ] Update `header.tsx` to use `useAuth()` instead of `store.user`
- [ ] Update `providers.tsx` with `<AuthProvider>`

**Day 5: Zustand Refactor**
- [ ] Strip `store.ts` down to UI-only state
- [ ] Remove `zusta nd/persist` for auth data
- [ ] Verify no component breaks (header, dashboard pages, admin page)

### Phase 2: Data Migration (Week 2)

**Day 1-2: Real Data Layer**
- [ ] Create React Query hooks: `use-bookings.ts`, `use-listings.ts`, `use-profile.ts`
- [ ] Rewrite `api-hooks.ts` with real Supabase queries
- [ ] Create Zod validation schemas in `validations.ts`
- [ ] Create `sanitize.ts` utilities
- [ ] Apply sanitization to `create-listing-wizard.tsx`

**Day 3-4: Storage**
- [ ] Run migration `00003_storage_buckets.sql`
- [ ] Create `src/app/api/upload/route.ts` with file validation
- [ ] Update wizard to upload images to Supabase Storage
- [ ] Add signed URL generation for protected downloads

**Day 5: Security Hardening**
- [ ] Create `rate-limit.ts` with LRU cache
- [ ] Add rate limiting to booking API + upload API
- [ ] Verify CSRF protection in middleware
- [ ] Test all RLS policies manually via Supabase dashboard
- [ ] Add webhook HMAC verification to payment route

### Phase 3: Admin & Polish (Week 3)

**Day 1-2: Admin Migration**
- [ ] Remove auto-login hack from `admin/page.tsx`
- [ ] Connect admin moderation to real Supabase queries
- [ ] Connect user management table to real profiles query
- [ ] Connect content editor to real help-content table (if needed)
- [ ] Create `admin_audit_log` table

**Day 3-4: Testing**
- [ ] Test full registration flow: signUp → email verification → profile created → login
- [ ] Test OAuth flow: Google sign-in → callback → profile → dashboard
- [ ] Test admin flow: login as admin → access /admin → mute user / approve listing
- [ ] Test RLS: attempt to read other user's bookings → should fail
- [ ] Test rate limiting: send 20 booking requests → should hit 429
- [ ] Test CSRF: POST from different origin → should get 403
- [ ] Test storage: upload >10MB file → should be rejected

**Day 5: Launch Checklist**
- [ ] Remove all demo/mock code comment blocks
- [ ] Remove `MOCK_LISTINGS`, `DEMO_HOST_LISTINGS`, `DEMO_HOST_BOOKINGS`
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] Deploy to staging environment
- [ ] Run through full QA checklist
- [ ] Deploy to production
- [ ] Monitor Supabase logs for auth errors (first 24h)

### Rollback Strategy

If auth breaks in production:
1. The old Zustand auth store is removed, but:
2. Keep a `legacy/` branch with the old demo auth code
3. Supabase auth can be toggled off via env: `AUTH_MODE=demo` (future-proofing)
4. Admin fallback: direct Supabase dashboard access always works

---

## Appendix A: Required npm Packages

```bash
npm install zod          # schema validation for API routes
npm install lru-cache    # rate limiting (or use @vercel/kv in production)
```

Already installed and needed:
- `@supabase/ssr` ✅ (v0.12.3)
- `@supabase/supabase-js` ✅ (v2.110.9)
- `@tanstack/react-query` ✅ (v5.101.4)

## Appendix B: Supabase Auth Configuration

In Supabase Dashboard → Authentication → Settings:

| Setting | Value |
|---------|-------|
| Site URL | `https://sakhalinstay.ru` (production) / `http://localhost:3000` (dev) |
| Redirect URLs | `http://localhost:3000/auth/callback`, `https://sakhalinstay.ru/auth/callback` |
| Email confirmations | ✅ Enabled |
| Minimum password length | 8 characters |
| OAuth Providers | Google (enabled), Yandex (enabled) |

## Appendix C: Security Checklist

- [ ] All tables have RLS enabled
- [ ] No table uses `USING (true)` for INSERT/UPDATE/DELETE without role check
- [ ] Service-role key is NEVER exposed client-side
- [ ] `ADMIN_EMAIL` is only in `.env.local`, never in client code
- [ ] All API routes validate input with Zod
- [ ] Rate limiting is active on booking + upload endpoints
- [ ] File uploads have size + MIME type validation
- [ ] Webhook endpoints verify signatures
- [ ] Session cookies are HTTP-only
- [ ] `middleware.ts` re-checks admin role from DB (not from cached JWT)
- [ ] No secrets in git history (verify with `git log -p`)
- [ ] `supabase auth admin` commands require 2FA
