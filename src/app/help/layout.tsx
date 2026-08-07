import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Как это работает",
  description: "Узнайте, как работает СахGO: размещение объявлений, бронирование жилья и туров, оплата и правила площадки для Сахалина и Курил.",
  alternates: { canonical: "https://sakhgo.ru/help" },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
