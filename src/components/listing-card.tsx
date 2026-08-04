"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { LISTING_LABELS } from "@/lib/data";
import { ListingType } from "@/lib/types";
import { Heart } from "lucide-react";

interface Props {
  id: string;
  title: string;
  type: ListingType;
  location: string;
  price: number;
  unit: string;
  rating: number;
  meta: string[];
  bg: string;
  onClick?: () => void;
  promo?: "top" | "hot" | "highlight" | null;
}

export function ListingCard({ id, title, type, location, price, unit, rating, meta, bg, onClick, promo }: Props) {
  const store = useStore();
  const liked = store.isFavorite(id);

  return (
    <Card
      className={cn(
        "group overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer",
        promo === "highlight" && "ring-2 ring-violet-500/50",
        promo === "top" && "ring-2 ring-amber-500/50",
        promo === "hot" && "ring-2 ring-rose-500/50"
      )}
      onClick={onClick}
    >
      <div className={cn("aspect-[4/3] relative", bg)}>
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant="secondary" className="bg-white/90 text-foreground border font-mono text-[11px]">
            {LISTING_LABELS[type]}
          </Badge>
          {promo && (
            <Badge className={cn(
              "font-mono text-[11px]",
              promo === "top" && "bg-amber-500 text-white",
              promo === "hot" && "bg-rose-500 text-white",
              promo === "highlight" && "bg-violet-500 text-white",
            )}>
              {promo === "top" ? "ТОП" : promo === "hot" ? "Горящие даты" : "Премиум"}
            </Badge>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 border hover:border-accent",
            liked && "text-accent border-accent bg-accent/5"
          )}
          onClick={(e) => { e.stopPropagation(); store.toggleFavorite(id); }}
        >
          <Heart className={cn("w-4 h-4", liked && "fill-accent")} />
        </Button>
      </div>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-widest text-accent font-medium mb-0.5">{location}</p>
        <h3 className="font-display text-lg leading-tight mb-2 text-foreground">{title}</h3>
        <div className="flex gap-3 text-sm text-muted-foreground mb-3">
          {meta.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="flex justify-between items-center pt-3 border-t">
          <div>
            <span className="font-display text-xl text-foreground">{price.toLocaleString("ru-RU")}</span>
            <span className="text-sm text-muted ml-1">{unit}</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <span className="w-3 h-3 bg-accent rounded-sm inline-block" />
            {rating}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
