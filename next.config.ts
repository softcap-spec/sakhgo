import type { NextConfig } from "next";

const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.vk.com https://yoomoney.ru https://api.yookassa.ru; frame-src 'self' https://yookassa.ru; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/((?!api/auth|_next/static|uploads).*)",
        headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
