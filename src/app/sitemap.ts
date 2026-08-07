import type { MetadataRoute } from "next";
import pool from "@/lib/pg";

const BASE = "https://sakhgo.ru";

const STATIC = [
  { url: "/", changefreq: "daily" as const, priority: 1.0 },
  { url: "/catalog", changefreq: "daily" as const, priority: 0.9 },
  { url: "/help", changefreq: "monthly" as const, priority: 0.5 },
  { url: "/privacy", changefreq: "yearly" as const, priority: 0.3 },
  { url: "/terms", changefreq: "yearly" as const, priority: 0.3 },
];

const CATEGORIES = [
  { slug: "housing", label: "Жильё" },
  { slug: "tours", label: "Туры" },
  { slug: "fishing", label: "Рыбалка" },
  { slug: "gear", label: "Снаряжение" },
  { slug: "rental", label: "Прокат авто" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${BASE}${s.url}`,
    lastModified: new Date(),
    changeFrequency: s.changefreq,
    priority: s.priority,
  }));

  // Category pages
  CATEGORIES.forEach((cat) => {
    entries.push({
      url: `${BASE}/catalog?category=${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    });
  });

  // Fetch active listings
  try {
    const { rows } = await pool.query(
      `SELECT id, updated_at FROM listings WHERE status = 'active' ORDER BY updated_at DESC LIMIT 500`
    );
    rows.forEach((row: { id: string; updated_at: string }) => {
      entries.push({
        url: `${BASE}/listing/${row.id}`,
        lastModified: new Date(row.updated_at),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    });
  } catch {
    // DB unreachable — return static only
  }

  return entries;
}
