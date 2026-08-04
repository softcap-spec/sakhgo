export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { AdToasts } from "@/components/ad-toasts";
import { ChatFAB } from "@/components/chat-fab";

const displayFont = Cormorant_Garamond({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});
const bodyFont = Inter({ subsets: ["cyrillic", "latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "СахGO — жильё, туры, рыбалка и снаряжение. Сахалин и Курилы — ближе, чем кажется",
  description: "СахGO — маркетплейс туруслуг и жилья для Сахалинской области и Курильских островов. Сахалин и Курилы — ближе, чем кажется.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" dir="ltr" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen flex flex-col" dir="ltr">
        <ReactQueryProvider>
          <Providers>
            <div className="flex-1 flex flex-col">
              {children}
              <AdToasts />
              <ChatFAB />
            </div>
          </Providers>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
