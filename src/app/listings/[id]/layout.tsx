import type { Metadata } from "next";
import pool from "@/lib/pg";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      `SELECT l.title, l.description, l.type, l.category, l.price, l.images, l.host_id
       FROM listings l WHERE l.id = $1 AND l.status = 'active'`,
      [id]
    );
    const listing = rows[0];
    if (!listing) return { title: "Объявление не найдено" };

    const LOCATIONS = {
      tours: "Туры и экскурсии", housing: "Жильё", fishing: "Рыбалка",
      gear: "Снаряжение", rental: "Прокат авто",
    };
    const catLabel = LOCATIONS[listing.type as keyof typeof LOCATIONS] || listing.type;
    const priceStr = listing.price ? `${Number(listing.price).toLocaleString("ru-RU")} ₽` : "";

    const title = `${listing.title} — ${catLabel} на Сахалине${priceStr ? `, ${priceStr}` : ""}`;
    const desc = listing.description?.replace(/<[^>]*>/g, "").slice(0, 155) || title;
    const image = listing.images?.[0] || "https://sakhgo.ru/og-image.png";

    return {
      title,
      description: desc,
      openGraph: {
        title,
        description: desc,
        type: "article",
        images: [{ url: image, width: 1200, height: 630, alt: listing.title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: [image],
      },
      alternates: {
        canonical: `https://sakhgo.ru/listings/${id}`,
      },
      other: {
        "article:section": catLabel,
      },
    };
  } catch {
    return { title: "Объявление | СахGO" };
  }
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
