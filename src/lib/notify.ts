// MAX Notification Service
// Sends moderation alerts to MAX messenger bot.

const MAX_API = "https://bot.max.ru/api/v1";

interface MaxNotifyConfig {
  token: string;
  chatId: string;
}

let config: MaxNotifyConfig | null = null;

export function configureMaxNotify(token: string, chatId: string) {
  config = { token, chatId };
}

function getConfig(): MaxNotifyConfig | null {
  if (config && config.token.length > 0 && config.chatId.length > 0) return config;
  return null;
}

export async function sendMaxNotification(text: string): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;

  try {
    const res = await fetch(`${MAX_API}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${cfg.token}`,
      },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
      }),
    });

    return res.ok;
  } catch {
    // Silently fail — notification is best-effort
    return false;
  }
}

// ── Telegram Bot Notifications ──
// Auto-configured from environment variables.
// Manual override available via configureTgNotify().

let tgBotToken: string | null = null;
let tgChatId: string | null = null;
let tgInitialized = false;

function initTgFromEnv() {
  if (tgInitialized) return;
  tgInitialized = true;
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (envToken && envChatId) {
    tgBotToken = envToken;
    tgChatId = envChatId;
    console.log("[tg] Configured from env");
  }
}

export function configureTgNotify(token: string, chatId: string) {
  tgBotToken = token;
  tgChatId = chatId;
  tgInitialized = true;
}

/** Escape HTML special chars for Telegram parse_mode=HTML */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send a formatted notification via Telegram Bot API.
 * Fire-and-forget: never throws, returns success boolean.
 */
export async function sendTgNotification(
  type: "new_user" | "new_booking" | "new_edit" | "test" | "info",
  text: string,
  link?: string
): Promise<boolean> {
  initTgFromEnv();
  if (!tgBotToken || !tgChatId) return false;

  const emoji: Record<string, string> = {
    new_user: "👤",
    new_booking: "📅",
    new_edit: "🛡",
    test: "✅",
    info: "ℹ️",
  };

  const label: Record<string, string> = {
    new_user: "Новый пользователь",
    new_booking: "Новая бронь",
    new_edit: "Объявление на модерации",
    test: "Тестовое уведомление",
    info: "СахGO",
  };

  const e = emoji[type] || "ℹ️";
  const title = label[type] || type;
  const safeText = escapeHtml(text);
  const safeLink = link ? escapeHtml(link) : "";

  let message = `<b>${e} СахGO · ${escapeHtml(title)}</b>\n${safeText}`;
  if (safeLink) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    message += `\n\n<a href="${escapeHtml(siteUrl)}${safeLink}">🔗 Открыть в админке</a>`;
  }

  // Emoji dot for new types
  if (type === "new_user") {
    message += `\n\n🟢 Новый пользователь зарегистрировался на платформе.`;
  } else if (type === "new_booking") {
    message += `\n\n🟡 Требуется подтверждение брони.`;
  } else if (type === "new_edit") {
    message += `\n\n🟠 Требуется проверка модератором.`;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${tgBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[tg] API error ${res.status}: ${errBody.slice(0, 200)}`);
      return false;
    }

    return true;
  } catch (e) {
    console.error("[tg] Network error:", (e as Error).message);
    return false;
  }
}

/** Check if Telegram notification config is available */
export function isTgConfigured(): boolean {
  initTgFromEnv();
  return !!(tgBotToken && tgChatId);
}
