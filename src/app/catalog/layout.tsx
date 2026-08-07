import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог объявлений",
  description: "Просмотрите все объявления на СахGO: жильё посуточно, туры и экскурсии, рыбалка, аренда снаряжения и прокат авто на Сахалине и Курилах. Найдите идеальный вариант для отдыха.",
  openGraph: {
    title: "Каталог объявлений | СахGO",
    description: "Жильё, туры, рыбалка и снаряжение на Сахалине и Курилах — сотни предложений от местных жителей.",
  },
  alternates: { canonical: "https://sakhgo.ru/catalog" },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
