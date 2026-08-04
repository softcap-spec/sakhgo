"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { apiGetReviews, apiAddReview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MessageSquare, CheckCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  listingId: string;
  guestId: string;
  guestName: string;
  guestAvatar?: string | null;
  rating: number;
  text: string;
  moderated: boolean;
  createdAt: string;
}

interface Props {
  listingId: string;
  listingTitle: string;
}

export function ReviewsSection({ listingId, listingTitle }: Props) {
  const store = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);

  const load = async () => {
    try {
      const list = await apiGetReviews(listingId) as Review[];
      setReviews(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [listingId]);

  const handleSubmit = async () => {
    if (!store.user || !text.trim()) return;
    try {
      await apiAddReview({
        listingId,
        guestId: store.user.id,
        guestName: store.user.name,
        guestAvatar: store.user.avatar || ((store.user as any).avatar_url || null),
        rating,
        text: text.trim(),
      });
      setSubmitted(true);
      setWriting(false);
    } catch {}
  };

  if (loading) return null;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <>
      <Separator />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl">Отзывы</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {reviews.length === 0 ? "Пока нет отзывов" : `${reviews.length} ${reviews.length === 1 ? "отзыв" : reviews.length < 5 ? "отзыва" : "отзывов"}`}
              {avgRating && <span className="ml-2">· {avgRating} ★</span>}
            </p>
          </div>
          {store.user && !writing && !submitted && (
            <Button variant="outline" size="sm" onClick={() => setWriting(true)} className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> Написать отзыв
            </Button>
          )}
        </div>

        {/* Write form */}
        {writing && (
          <div className="bg-card border rounded-xl p-5 space-y-4 animate-slide-in">
            <div>
              <p className="text-sm font-medium mb-2">Ваша оценка</p>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverStar(n)}
                    onMouseLeave={() => setHoverStar(0)}
                    className="text-2xl transition-colors"
                  >
                    <Star className={cn(
                      "w-7 h-7",
                      (hoverStar || rating) >= n ? "text-yellow-500 fill-yellow-500" : "text-muted"
                    )} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Расскажите о вашем опыте..."
                rows={4}
                className="resize-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Отзыв будет опубликован после проверки модератором.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setWriting(false)}>Отмена</Button>
              <Button onClick={handleSubmit} disabled={!text.trim()} size="sm" className="gap-1.5">
                <Send className="w-3.5 h-3.5" /> Отправить
              </Button>
            </div>
          </div>
        )}

        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center animate-slide-in">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-900">Спасибо!</p>
            <p className="text-sm text-green-700 mt-0.5">Отзыв отправлен на модерацию и скоро будет опубликован.</p>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="flex gap-4">
                <Avatar className="w-10 h-10 shrink-0">
                  {r.guestAvatar ? (
                    <img src={r.guestAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-accent/10 text-accent text-sm font-semibold">
                      {(r.guestName || "Г")[0].toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.guestName}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={cn(
                          "w-3 h-3",
                          n <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted"
                        )} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
