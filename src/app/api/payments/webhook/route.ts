import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payments/webhook
 *
 * Принимает уведомления от платёжных систем (T-Bank / Yookassa).
 *
 * Формат входящего тела (унифицированный):
 * {
 *   event: "payment.succeeded" | "payment.canceled" | "refund.succeeded",
 *   object: {
 *     id: string;            // ID платежа в платёжной системе
 *     amount: { value: string; currency: string };
 *     metadata: {
 *       promotion_id: string;  // UUID записи в таблице promotions
 *       listing_id: string;    // UUID объявления
 *       host_id: string;       // UUID владельца
 *       promo_type: "top" | "hot" | "highlight";
 *     };
 *   }
 * }
 *
 * T-Bank API: https://www.tbank.ru/business/payments/
 * Yookassa API: https://yookassa.ru/developers/api
 *
 * Безопасность:
 * - В продакшене добавить проверку подписи вебхука
 *   (IP-whitelist + HMAC / secret key валидация)
 * - T-Bank: заголовок Tbank-Signature с SHA-256 HMAC
 * - Yookassa: проверять IP из списка Yookassa
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

    if (!metadata?.promotion_id || !metadata?.listing_id) {
      return NextResponse.json(
        { error: "Missing promotion metadata" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] ${event} | payment: ${paymentId} | promo: ${metadata.promotion_id}`);

    switch (event) {
      case "payment.succeeded": {
        // Активировать продвижение в БД
        // await supabase
        //   .from("promotions")
        //   .update({
        //     payment_status: "paid",
        //     paid_at: new Date().toISOString(),
        //     status: "active",
        //     starts_at: new Date().toISOString(),
        //     expires_at: new Date(Date.now() + getDuration(metadata.promo_type)).toISOString(),
        //     transaction_id: paymentId,
        //   })
        //   .eq("id", metadata.promotion_id);

        // Обновить объявление — установить promo_type
        // await supabase
        //   .from("listings")
        //   .update({ promo_type: metadata.promo_type })
        //   .eq("id", metadata.listing_id);

        return NextResponse.json({
          status: "ok",
          action: "activated",
          promotion_id: metadata.promotion_id,
          listing_id: metadata.listing_id,
        });
      }

      case "payment.canceled": {
        // Отменить продвижение
        // await supabase
        //   .from("promotions")
        //   .update({ payment_status: "failed", status: "archived" })
        //   .eq("id", metadata.promotion_id);

        return NextResponse.json({
          status: "ok",
          action: "canceled",
          promotion_id: metadata.promotion_id,
        });
      }

      case "refund.succeeded": {
        // Деактивировать продвижение при возврате
        // await supabase
        //   .from("promotions")
        //   .update({ payment_status: "refunded", status: "archived" })
        //   .eq("id", metadata.promotion_id);

        // await supabase
        //   .from("listings")
        //   .update({ promo_type: null })
        //   .eq("id", metadata.listing_id);

        return NextResponse.json({
          status: "ok",
          action: "refunded",
          promotion_id: metadata.promotion_id,
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

/**
 * Вспомогательная: длительность промо в миллисекундах
 */
function getDuration(promoType: string): number {
  switch (promoType) {
    case "hot":
      return 3 * 24 * 60 * 60 * 1000; // 3 дня
    case "top":
    case "highlight":
    default:
      return 7 * 24 * 60 * 60 * 1000; // 7 дней
  }
}
