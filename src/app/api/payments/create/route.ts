/**
 * POST /api/payments/create
 *
 * Создаёт платёж в ЮKassa и возвращает URL для редиректа хоста.
 *
 * Тело запроса: { promotionId: string }
 *
 * Переменные окружения:
 *   YOOKASSA_SHOP_ID       — shopId из личного кабинета ЮKassa
 *   YOOKASSA_SECRET        — secretKey из личного кабинета ЮKassa
 *   NEXT_PUBLIC_SITE_URL   — https://sakhgo.ru
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import pool from "@/lib/pg";
import { randomUUID } from "crypto";

const SHOP_ID  = process.env.YOOKASSA_SHOP_ID;
const SECRET   = process.env.YOOKASSA_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sakhgo.ru";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!SHOP_ID || !SECRET) {
    console.error("[payments/create] YOOKASSA env vars not set");
    return NextResponse.json({ ok: false, error: "Payment not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { promotionId } = body;
  if (!promotionId) {
    return NextResponse.json({ ok: false, error: "promotionId required" }, { status: 400 });
  }

  // Загружаем промо — проверяем владельца и статус
  const { rows: [promo] } = await pool.query(
    `SELECT p.id, p.host_id, p.listing_id, p.promo_type,
            p.duration_days, p.price, p.status, p.payment_id, p.payment_url,
            l.title AS listing_title
     FROM promotions p
     JOIN listings l ON l.id = p.listing_id
     WHERE p.id = $1`,
    [promotionId]
  );

  if (!promo) {
    return NextResponse.json({ ok: false, error: "Промо не найдено" }, { status: 404 });
  }
  if (promo.host_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (promo.status === "active" || promo.status === "paid") {
    return NextResponse.json({ ok: false, error: "Промо уже активно" }, { status: 409 });
  }

  // Если платёж уже создан ранее — возвращаем тот же URL (не создаём дубль)
  if (promo.payment_id && promo.payment_url) {
    return NextResponse.json({ ok: true, data: { paymentUrl: promo.payment_url } });
  }

  const amount = Number(promo.price ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректная цена промо" }, { status: 400 });
  }

  const promoLabel: Record<string, string> = {
    top:       "Топ объявления",
    highlight: "Выделение объявления",
    urgent:    "Срочная продажа",
  };
  const days        = promo.duration_days ?? 7;
  const description = `${promoLabel[promo.promo_type] ?? "Продвижение"}: «${promo.listing_title}» (${days} дней)`;

  const idempotencyKey = randomUUID();

  // Создаём платёж в ЮKassa
  let yookassaData: any;
  try {
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "Idempotence-Key": idempotencyKey,
        "Authorization":   "Basic " + Buffer.from(`${SHOP_ID}:${SECRET}`).toString("base64"),
      },
      body: JSON.stringify({
        amount:    { value: amount.toFixed(2), currency: "RUB" },
        capture:   true,
        confirmation: {
          type:       "redirect",
          return_url: `${BASE_URL}/dashboard?promo_result=success&promotion_id=${promotionId}`,
        },
        description,
        metadata: {
          promotion_id: promotionId,
          listing_id:   promo.listing_id,
          host_id:      promo.host_id,
          promo_type:   promo.promo_type,
        },
      }),
    });

    yookassaData = await res.json();

    if (!res.ok) {
      console.error("[payments/create] ЮKassa error:", yookassaData);
      return NextResponse.json(
        { ok: false, error: yookassaData?.description ?? "Ошибка платёжного шлюза" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[payments/create] fetch error:", err);
    return NextResponse.json({ ok: false, error: "Платёжный шлюз недоступен" }, { status: 502 });
  }

  const paymentId  = yookassaData.id as string;
  const paymentUrl = yookassaData.confirmation?.confirmation_url as string;

  // Сохраняем payment_id и URL, переводим в статус pending
  await pool.query(
    `UPDATE promotions
     SET payment_id      = $2,
         idempotency_key = $3,
         payment_url     = $4,
         status          = 'pending',
         updated_at      = now()
     WHERE id = $1`,
    [promotionId, paymentId, idempotencyKey, paymentUrl]
  );

  return NextResponse.json({ ok: true, data: { paymentUrl } });
}
