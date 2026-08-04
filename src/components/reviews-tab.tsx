"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiGetPendingReviews, apiModerateReview } from "@/lib/api";

interface PendingReview {
  id: string;
  listing_id: string;
  guest_id: string;
  guest_name?: string;
  guestName?: string;
  guest_avatar?: string;
  guestAvatar?: string;
  rating: number;
  text: string;
  created_at: string;
}

export function ReviewsTab() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const list = await apiGetPendingReviews() as PendingReview[];
      setReviews(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleModerate = async (id: string, approved: boolean) => {
    try {
      await apiModerateReview(id, approved);
      setReviews(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  return (
    <div>
      <h2 className="font-display text-2xl mb-6">Модерация отзывов</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p className="text-lg">Все отзывы проверены</p>
          <p className="text-sm">Новых отзывов на модерацию нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card border rounded-lg p-5 space-y-3">
              <div className="flex items-start gap-4">
                <Avatar className="w-10 h-10 shrink-0">
                  {r.guestAvatar || r.guest_avatar ? (
                    <img src={r.guestAvatar || r.guest_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-accent/10 text-accent text-sm font-semibold">
                      {((r.guest_name || r.guestName || "Г")[0] || "Г").toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{r.guest_name || r.guestName}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={cn("w-3.5 h-3.5", n <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted")} />
                      ))}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">На модерации</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
                  <p className="text-xs text-muted mt-1">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 gap-1.5"
                  onClick={() => handleModerate(r.id, true)}>
                  <CheckCircle className="w-4 h-4" /> Одобрить
                </Button>
                <Button size="sm" variant="destructive" className="gap-1.5"
                  onClick={() => handleModerate(r.id, false)}>
                  <XCircle className="w-4 h-4" /> Отклонить
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
