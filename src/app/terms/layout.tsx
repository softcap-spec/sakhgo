import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Условия использования",
  description: "Условия использования СахGO. Ознакомьтесь с правилами размещения объявлений, бронирования, отмены и ответственности на платформе Сахалина и Курил.",
  alternates: { canonical: "https://sakhgo.ru/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
