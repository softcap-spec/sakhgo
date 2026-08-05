import { NextRequest, NextResponse } from "next/server";
import { dbGetPromotionById, dbUpdatePromotionStatus } from "@/lib/db";
import { verifyYooKassaNotification } from "@/lib/yookassa";

/**
 * POST /api/payments/webhook
 *
 * Принимает уведомления от ЮKassa.
 * Формат: https://yookassa.ru/developers/using-api/webhooks
 *
 * ЮKassa шлёт:
 * {
 *   type: "notification",
 *   event: "payment.succeeded" | "payment.canceled" | "refund.succeeded",
 *   object: { id, status, amount, metadata: { promotion_id, host_id } }
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { valid, event, metadata } = verifyYooKassaNotification(body);

    if (!valid || !metadata?.promotion_id) {
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    }

    const promoId = metadata.promotion_id;
    const promo = await dbGetPromotionById(promoId);
    if (!promo) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    console.log(`[Webhook] ${event} | promo: ${promoId} | payment: ${body.object?.id}`);

    switch (event) {
      case "payment.succeeded": {
        await dbUpdatePromotionStatus(promoId, "active");
        return NextResponse.json({ status: "ok", action: "activated" });
      }

      case "payment.canceled": {
        await dbUpdatePromotionStatus(promoId, "cancelled");
        return NextResponse.json({ status: "ok", action: "canceled" });
      }

      case "refund.succeeded": {
        await dbUpdatePromotionStatus(promoId, "refunded");
        return NextResponse.json({ status: "ok", action: "refunded" });
      }

      default:
        return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}