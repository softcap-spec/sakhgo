export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { ChatFAB } from "@/components/chat-fab";

const displayFont = Cormorant_Garamond({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});
const bodyFont = Inter({ subsets: ["cyrillic", "latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://sakhgo.ru"),
  title: {
    default: "СахGO — жильё, туры, рыбалка и снаряжение. Сахалин и Курилы — ближе, чем кажется",
    template: "%s | СахGO",
  },
  description: "Маркетплейс туруслуг, жилья и рыбалки для Сахалинской области и Курильских островов. Снимите квартиру, забронируйте джип-тур или морскую прогулку напрямую от местных.",
  keywords: ["Сахалин", "Курилы", "туры", "жильё", "рыбалка", "снаряжение", "аренда", "посуточно", "джип-тур", "морская прогулка", "сноуборд", "квартира", "Южно-Сахалинск"],
  authors: [{ name: "СахGO" }],
  creator: "СахGO",
  publisher: "СахGO",
  formatDetection: { telephone: true, email: true, address: true },

  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  alternates: {
    canonical: "https://sakhgo.ru",
  },

  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://sakhgo.ru",
    siteName: "СахGO",
    title: "СахGO — жильё, туры, рыбалка и снаряжение. Сахалин и Курилы — ближе, чем кажется",
    description: "Маркетплейс туруслуг, жилья и рыбалки для Сахалина и Курил. Снимите квартиру, забронируйте тур или рыбалку напрямую от местных жителей.",
    images: [
      {
        url: "https://sakhgo.ru/og-image.png",
        width: 1200,
        height: 630,
        alt: "СахGO — маркетплейс Сахалина и Курил",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "СахGO — жильё, туры, рыбалка и снаряжение",
    description: "Маркетплейс Сахалина и Курил. Жильё, джип-туры, морские выходы, рыбалка и снаряжение — напрямую от местных.",
    images: ["https://sakhgo.ru/og-image.png"],
  },

  verification: {
    // Add after registering: yandex, google
    // google: "xxx",
    // yandex: "xxx",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" dir="ltr" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen flex flex-col" dir="ltr">
        <ReactQueryProvider>
          <Providers>
            <div className="flex-1 flex flex-col">
              {children}
              <ChatFAB />
            </div>
          </Providers>
        </ReactQueryProvider>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "СахGO",
                "url": "https://sakhgo.ru",
                "logo": "https://sakhgo.ru/logo.png",
                "description": "Маркетплейс туруслуг, жилья и рыбалки для Сахалинской области и Курильских островов.",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Южно-Сахалинск",
                  "addressRegion": "Сахалинская область",
                  "addressCountry": "RU",
                },
                "sameAs": [],
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "СахGO",
                "url": "https://sakhgo.ru",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "https://sakhgo.ru/search?q={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
          }}
        />
      </body>
    </html>
  );
}
