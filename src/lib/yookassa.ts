/**
 * YooKassa (ЮKassa) payment integration
 * API docs: https://yookassa.ru/developers/api
 * Test shop: uses test_ prefix secret key
 */

const YOOKASSA_API = "https://api.yookassa.ru/v3/";

type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  confirmation: { type: string; confirmation_url: string };
};

type YooKassaNotification = {
  type: string; // "notification"
  event: "payment.succeeded" | "payment.canceled" | "refund.succeeded";
  object: {
    id: string;
    status: string;
    amount: { value: string; currency: string };
    metadata?: Record<string, string>;
  };
};

function yooAuth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID || "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY || "";
  return Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export function isYooKassaTestMode(): boolean {
  return (process.env.YOOKASSA_SECRET_KEY || "").startsWith("test_");
}

/**
 * Create a YooKassa payment and return the confirmation URL.
 * The customer will be redirected to YooKassa's payment page.
 */
export async function initYooKassaPayment(opts: {
  promotionId: string;
  hostId: string;
  listingTitle: string;
  amountRub: number;
}): Promise<{ success: boolean; paymentUrl?: string; paymentId?: string; error?: string }> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  if (!shopId) return { success: false, error: "YooKassa not configured" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sakhgo.ru";
  const idempotenceKey = `${opts.promotionId}-${Date.now()}`;

  const payload = {
    amount: {
      value: opts.amountRub.toFixed(2),
      currency: "RUB",
    },
    capture: true, // auto-capture — деньги списываются сразу
    confirmation: {
      type: "redirect",
      return_url: `${siteUrl}/dashboard/payment/result?orderId=${opts.promotionId}`,
    },
    description: `Продвижение: ${opts.listingTitle.slice(0, 128)}`,
    metadata: {
      promotion_id: opts.promotionId,
      host_id: opts.hostId,
    },
  };

  console.log("[YooKassa] Init:", JSON.stringify(payload));

  try {
    const resp = await fetch(YOOKASSA_API + "payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${yooAuth()}`,
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json() as YooKassaPayment & { type?: string; description?: string };
    console.log("[YooKassa] Response:", resp.status, JSON.stringify(data));

    if (data.confirmation?.confirmation_url) {
      return {
        success: true,
        paymentUrl: data.confirmation.confirmation_url,
        paymentId: data.id,
      };
    }

    const desc = (data as { description?: string }).description;
    return { success: false, error: desc || `Payment init failed (${resp.status})` };
  } catch (err) {
    console.error("[YooKassa] Error:", err);
    return { success: false, error: "Network error" };
  }
}

/**
 * Verify a YooKassa webhook notification.
 * In test mode we check basic structure.
 * In production, verify IP + optional signature.
 */
export function verifyYooKassaNotification(body: YooKassaNotification): { valid: boolean; event: string; metadata: Record<string, string> | null } {
  if (!body.event || !body.object?.metadata) {
    return { valid: false, event: "", metadata: null };
  }

  // Test mode: accept all well-formed notifications
  if (isYooKassaTestMode()) {
    return {
      valid: true,
      event: body.event,
      metadata: body.object.metadata,
    };
  }

  // Production: TODO verify IP whitelist + signature
  return {
    valid: true,
    event: body.event,
    metadata: body.object.metadata,
  };
}
