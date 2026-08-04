"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGetCrossSell } from "@/lib/api";
import { labelFromType, formatPrice, priceUnit } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrossSellItem {
  id: string;
  title: string;
  type: string;
  location: string;
  price: number;
  price_unit: string;
  image: string | null;
}

const TYPE_BG: Record<string, string> = {
  property: "from-[#C5D5E4] via-[#8FB0C8] to-[#5A8AA8]",
  tour: "from-[#D4CBB8] via-[#B5A080] to-[#8B7250]",
  fishing: "from-[#70A8B0] via-[#388890] to-[#186068]",
  rental_gear: "from-[#C8C0B8] via-[#A09888] to-[#686050]",
  car_rental: "from-[#4A6FA5] via-[#2E5090] to-[#1A3A6E]",
};
const TYPE_ICON: Record<string, string> = {
  property: "🏠",
  tour: "🎒",
  fishing: "🎣",
  rental_gear: "🎿",
  car_rental: "🚗",
};

interface Props {
  listingId: string;
}

export function CrossSellPanel({ listingId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CrossSellItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetCrossSell(listingId) as CrossSellItem[];
        setItems(data);
      } catch {}
      setLoading(false);
    })();
  }, [listingId]);

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
        Для вашего путешествия
      </h3>

      <div className="space-y-2">
        {items.map((item) => {
          const hasImage = !!item.image;
          const bg = TYPE_BG[item.type] || "from-slate-200 via-slate-300 to-slate-400";
          const icon = TYPE_ICON[item.type] || "📦";

          return (
            <Card
              key={item.id}
              className="group overflow-hidden border cursor-pointer hover:-translate-y-0.5 hover:shadow-sm transition-all"
              onClick={() => router.push(`/listings/${item.id}`)}
            >
              <div className="flex gap-3">
                {/* thumbnail */}
                <div className={cn(
                  "w-20 h-20 shrink-0 relative overflow-hidden",
                  !hasImage && "bg-gradient-to-br " + bg
                )}>
                  {hasImage ? (
                    <img src={item.image!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">
                      {icon}
                    </div>
                  )}
                </div>

                {/* info */}
                <CardContent className="p-2.5 flex-1 min-w-0">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mb-1">
                    {labelFromType(item.type)}
                  </Badge>
                  <h4 className="text-sm font-medium leading-tight line-clamp-2 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />{item.location}
                  </p>
                  <p className="text-sm font-display font-medium mt-1">
                    {formatPrice(item.price || 0)}
                    <span className="text-[10px] text-muted-foreground ml-1">{priceUnit(item.type)}</span>
                  </p>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
