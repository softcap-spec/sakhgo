import nodemailer from "nodemailer";

// SMTP config — use env vars in production, hardcoded for local dev
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@sakhgo.ru")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
  }
  return transporter;
}

export async function sendAdminEmailNotification(type: string, text: string, link?: string) {
  const emails = ADMIN_EMAILS;
  if (emails.length === 0) {
    console.log("[email] No admin emails configured, skipping");
    return;
  }

  const subjectMap: Record<string, string> = {
    new_edit: "🔔 Новое объявление на модерацию",
    new_user: "👤 Новый пользователь",
    new_booking: "📅 Новая бронь",
  };

  const subject = subjectMap[type] || `🔔 Уведомление: ${type}`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">
      <div style="background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size: 28px; margin-bottom: 16px;">🔔</div>
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #111;">${subject}</h2>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;">${text}</p>
        ${link ? `<a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Открыть в админке</a>` : ""}
      </div>
      <div style="text-align: center; margin-top: 16px; font-size: 11px; color: #999;">
        SakhGo · Уведомления для администраторов
      </div>
    </div>
  `;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_CONFIG.auth.user || "noreply@sakhgo.ru",
      to: emails.join(", "),
      subject,
      html: htmlBody,
    });
    console.log(`[email] Sent "${subject}" to ${emails.join(", ")}`);
  } catch (e) {
    console.error("[email] Failed to send:", e);
  }
}

/** Send notification email to a specific user about messages or bookings */
export async function sendUserEmailNotification(toEmail: string, type: "message" | "booking", listingTitle: string, fromName: string, text: string, link?: string) {
  const subjectMap: Record<string, string> = {
    message: `💬 Новое сообщение — ${listingTitle}`,
    booking: `📅 Новая бронь — ${listingTitle}`,
  };

  const subject = subjectMap[type] || subjectMap.message;
  const actionLabel = type === "message" ? "Новое сообщение" : "Новая бронь";
  const cta = type === "message" ? "Ответить" : "Посмотреть";

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f0f5ff; border-radius: 12px;">
      <div style="background: #fff; border-radius: 10px; padding: 28px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size: 24px; margin-bottom: 12px;">🔔</div>
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px; color: #1a2236;">${actionLabel}</h2>
        <p style="font-size: 13px; color: #888; margin: 0 0 16px;">от ${fromName} · объявление «${listingTitle}»</p>
        <div style="background: #f8f9fb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0;">${text}</p>
        </div>
        ${link ? `<a href="${link}" style="display: inline-block; padding: 11px 24px; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">${cta} →</a>` : ""}
        <p style="margin-top: 20px; font-size: 11px; color: #aaa;">Это письмо отправлено автоматически. Вы можете отключить уведомления в настройках профиля на СахGO.</p>
      </div>
      <div style="text-align: center; margin-top: 14px; font-size: 11px; color: #999;">
        СахGO — жильё, туры, рыбалка, снаряжение на Сахалине
      </div>
    </div>
  `;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_CONFIG.auth.user || "noreply@sakhgo.ru",
      to: toEmail,
      subject,
      html: htmlBody,
    });
    console.log(`[email] Sent "${subject}" to ${toEmail}`);
  } catch (e) {
    console.error("[email] Failed to send user notification:", e);
  }
}

/** Send password reset email with a one-time link */
export async function sendPasswordResetEmail(toEmail: string, userName: string, resetLink: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sakhgo.ru";
  const fullLink = resetLink.startsWith("http") ? resetLink : BASE_URL + resetLink;

  const htmlBody = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f0f5ff;border-radius:12px">',
    '<div style="background:#fff;border-radius:10px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">',
    '<div style="font-size:28px;margin-bottom:12px">🔐</div>',
    '<h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:#1a2236">Восстановление пароля</h2>',
    '<p style="font-size:14px;color:#555;margin:8px 0 16px">Здравствуйте, ' + userName + '!</p>',
    '<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">Мы получили запрос на сброс пароля для вашего аккаунта на СахGO. Если это не вы — просто проигнорируйте это письмо.</p>',
    '<a href="' + fullLink + '" style="display:inline-block;padding:12px 28px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Сбросить пароль →</a>',
    '<p style="margin-top:20px;font-size:11px;color:#aaa">Ссылка действительна 1 час. Если кнопка не работает, скопируйте ссылку: ' + fullLink + '</p>',
    '</div>',
    '<div style="text-align:center;margin-top:14px;font-size:11px;color:#999">СахGO — жильё, туры, рыбалка, снаряжение на Сахалине</div>',
    '</div>'
  ].join("\n");

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_CONFIG.auth.user || "noreply@sakhgo.ru",
      to: toEmail,
      subject: "Сброс пароля — СахGO",
      html: htmlBody,
    });
    console.log("[email] Sent password reset to " + toEmail);
  } catch (e) {
    console.error("[email] Failed to send password reset:", e);
  }
}

/** Check if a user has email notifications enabled */
export async function dbUserEmailEnabled(userId: string): Promise<{ email: string; enabled: boolean } | null> {
  const pool = (await import("./pg")).default;
  const { rows } = await pool.query(
    "SELECT email, COALESCE(email_notifications, true) as email_notifications FROM profiles WHERE id = $1",
    [userId]
  );
  if (!rows[0]) return null;
  return { email: rows[0].email, enabled: rows[0].email_notifications };
}
