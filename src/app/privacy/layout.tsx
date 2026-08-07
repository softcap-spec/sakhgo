import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности СахGO. Узнайте, как мы собираем, используем и защищаем ваши персональные данные в соответствии с законодательством РФ.",
  alternates: { canonical: "https://sakhgo.ru/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
