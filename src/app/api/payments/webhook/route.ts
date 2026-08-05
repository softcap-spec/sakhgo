/**
 * POST /api/payments/webhook
 *
 * Принимает уведомления от ЮKassa о статусе платежа.
 *
 * Безопасность (ЮKassa не использует HMAC-подпись на теле запроса — только IP-whitelist):
 *   — Проверяем IP отправителя по официальному списку ЮKassa
 *   — Идемпотентность: каждый event_id пишем в payment_events ОДИН раз
 *   — После записи события запрашиваем актуальный статус платежа из ЮKassa API
 *     (не доверяем телу вебхука напрямую — защита от replay/spoofing)
 *
 * Документация: https://yookassa.ru/developers/using-api/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pg";

export const dynamic = "force-dynamic";

// Официальные IP ЮKassa для webhook-уведомлений
// Актуальный список: https://yookassa.ru/developers/using-api/webhooks#ip
const YOOKASSA_IPS = new Set([
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32",
]);

// Простая проверка по точному IP (без CIDR) — достаточно для большинства случаев.
// Если сервер за Nginx/proxy — X-Real-IP или X-Forwarded-For должен прокидываться.
function isYookassaIP(ip: string): boolean {
  // Точные совпадения
  if (YOOKASSA_IPS.has(ip)) return true;
  // CIDR-проверка для основных диапазонов (упрощённо — проверяем первые октеты)
  const cidrs = [
    { prefix: "185.71.76.", bits: 27, start: 0,   end: 31  },
    { prefix: "185.71.77.", bits: 27, start: 0,   end: 31  },
    { prefix: "77.75.153.", bits: 25, start: 0,   end: 127 },
    { prefix: "77.75.154.", bits: 25, start: 128, end: 255 },
  ];
  for (const { prefix, start, end } of cidrs) {
    if (ip.startsWith(prefix)) {
      const last = parseInt(ip.split(".")[3] ?? "-1", 10);
      if (last >= start && last <= end) return true;
    }
  }
  return false;
}

const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET  = process.env.YOOKASSA_SECRET;

async function getYookassaPayment(paymentId: string) {
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SHOP_ID}:${SECRET}`).toString("base64"),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  // 1. Проверяем IP
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp    = req.headers.get("x-real-ip");
  const clientIp  = (forwarded?.split(",")[0] ?? realIp ?? "").trim();

  if (!isYookassaIP(clientIp)) {
    console.warn(`[webhook] Rejected unknown IP: ${clientIp}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Парсим тело
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType  = body?.event        as string | undefined;
  const paymentId  = body?.object?.id   as string | undefined;
  const metadata   = body?.object?.metadata ?? {};
  const promotionId = metadata?.promotion_id as string | undefined;

  if (!eventType || !paymentId) {
    return NextResponse.json({ error: "Missing event or object.id" }, { status: 400 });
  }

  // event_id — используем paymentId+eventType как уникальный ключ (ЮKassa не шлёт отдельный event UUID)
  const eventId = `${paymentId}::${eventType}`;

  // 3. Идемпотентность — пишем событие в лог; если уже есть — отвечаем 200 без повторной обработки
  try {
    await pool.query(
      `INSERT INTO payment_events (event_id, event_type, payment_id, promotion_id, raw_body)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, eventType, paymentId, promotionId ?? null, JSON.stringify(body)]
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      // unique_violation — уже обрабатывали это событие
      console.log(`[webhook] Duplicate event ${eventId}, skipping`);
      return NextResponse.json({ status: "already_processed" });
    }
    throw err;
  }

  // 4. Для payment.succeeded — верифицируем статус напрямую через API (не доверяем только вебхуку)
  if (eventType === "payment.succeeded") {
    if (!promotionId) {
      console.error(`[webhook] payment.succeeded without promotion_id, paymentId=${paymentId}`);
      return NextResponse.json({ status: "ok_no_promo" });
    }

    // Дополнительная верификация — запрашиваем актуальное состояние платежа у ЮKassa
    const actualPayment = await getYookassaPayment(paymentId);
    if (!actualPayment || actualPayment.status !== "succeeded") {
      console.warn(`[webhook] payment ${paymentId} not confirmed by API, status=${actualPayment?.status}`);
      return NextResponse.json({ error: "Payment not confirmed" }, { status: 409 });
    }

    const paidAmount = parseFloat(actualPayment.amount?.value ?? "0");

    // 5. Активируем промо + обновляем объявление в одной транзакции
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Обновляем promotions
      const { rows: [updated] } = await client.query(
        `UPDATE promotions
         SET status    = 'active',
             paid_at   = now(),
             starts_at = now(),
             expires_at = now() + (COALESCE(duration_days, 7) || ' days')::interval,
             price     = COALESCE(price, $3),
             updated_at = now()
         WHERE id = $1 AND payment_id = $2
         RETURNING id, listing_id, promo_type, duration_days, expires_at`,
        [promotionId, paymentId, paidAmount]
      );

      if (!updated) {
        await client.query("ROLLBACK");
        console.warn(`[webhook] Promotion not found or payment_id mismatch: promo=${promotionId}`);
        return NextResponse.json({ error: "Promotion mismatch" }, { status: 409 });
      }

      // Обновляем listings.promo + promo_expires_at
      await client.query(
        `UPDATE listings
         SET promo           = $2,
             promo_expires_at = $3,
             updated_at       = now()
         WHERE id = $1`,
        [updated.listing_id, updated.promo_type, updated.expires_at]
      );

      await client.query("COMMIT");

      console.log(`[webhook] Promotion ${promotionId} activated until ${updated.expires_at}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ status: "ok", action: "activated" });
  }

  // 6. payment.canceled — переводим в cancelled
  if (eventType === "payment.canceled") {
    if (promotionId) {
      await pool.query(
        `UPDATE promotions
         SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND payment_id = $2 AND status = 'pending'`,
        [promotionId, paymentId]
      );
    }
    return NextResponse.json({ status: "ok", action: "cancelled" });
  }

  // 7. refund.succeeded — деактивируем промо
  if (eventType === "refund.succeeded") {
    if (promotionId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows: [promo] } = await client.query(
          `UPDATE promotions
           SET status       = 'refunded',
               refunded_at  = now(),
               expires_at   = now(),
               updated_at   = now()
           WHERE id = $1 AND payment_id = $2
           RETURNING listing_id`,
          [promotionId, paymentId]
        );

        if (promo) {
          await client.query(
            `UPDATE listings
             SET promo = null, promo_expires_at = null, updated_at = now()
             WHERE id = $1`,
            [promo.listing_id]
          );
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    return NextResponse.json({ status: "ok", action: "refunded" });
  }

  // Неизвестное событие — логируем, отвечаем 200 (чтобы ЮKassa не ретраила)
  console.log(`[webhook] Unhandled event type: ${eventType}`);
  return NextResponse.json({ status: "ok", action: "ignored" });
}
