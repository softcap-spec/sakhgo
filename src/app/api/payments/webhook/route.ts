import { NextRequest, NextResponse } from "next/server";
import { dbGetPromotionById, dbUpdatePromotionStatus } from "@/lib/db";

/**
 * POST /api/payments/webhook
 *
 * Принимает уведомления от платёжных систем (T-Bank / Yookassa).
 * Также используется для симуляции платежа в тестовом режиме.
 *
 * Формат входящего тела (унифицированный):
 * {
 *   event: "payment.succeeded" | "payment.canceled" | "refund.succeeded",
 *   object: {
 *     id: string;
 *     amount: { value: string; currency: string };
 *     metadata: {
 *       promotion_id: string;
 *       listing_id: string;
 *       host_id: string;
 *       promo_type: "top" | "urgent" | "highlight";
 *     };
 *   }
 * }
 *
 * Безопасность (TODO для продакшена):
 * - Проверка подписи вебхука (HMAC)
 * - IP-whitelist платёжной системы
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, object } = body;

    if (!event || !object) {
      return NextResponse.json(
        { error: "Missing event or object" },
        { status: 400 }
      );
    }

    const { id: paymentId, amount, metadata } = object;
    const promoId = metadata?.promotion_id;

    if (!promoId || !metadata?.listing_id) {
      return NextResponse.json(
        { error: "Missing promotion metadata" },
        { status: 400 }
      );
    }

    // Verify promotion exists
    const promo = await dbGetPromotionById(promoId);
    if (!promo) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    console.log(`[Webhook] ${event} | payment: ${paymentId} | promo: ${promoId}`);

    switch (event) {
      case "payment.succeeded": {
        await dbUpdatePromotionStatus(promoId, "active");
        return NextResponse.json({
          status: "ok",
          action: "activated",
          promotion_id: promoId,
          listing_id: metadata.listing_id,
        });
      }

      case "payment.canceled": {
        await dbUpdatePromotionStatus(promoId, "cancelled");
        return NextResponse.json({
          status: "ok",
          action: "canceled",
          promotion_id: promoId,
        });
      }

      case "refund.succeeded": {
        await dbUpdatePromotionStatus(promoId, "refunded");
        return NextResponse.json({
          status: "ok",
          action: "refunded",
          promotion_id: promoId,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown event: ${event}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
