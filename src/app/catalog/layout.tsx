import type { Metadata } from "next";
import { Suspense } from "react";

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
  return (
    <>
      <Suspense fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Загрузка каталога...</div>
        </div>
      }>
        {children}
      </Suspense>
    </>
  );
}
