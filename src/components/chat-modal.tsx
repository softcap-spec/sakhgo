"use client";

import { useState, useEffect, useRef } from "react";
import { useStore, formatPrice } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft, CheckCheck } from "lucide-react";

interface Message {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface ChatPreview {
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string;
  last_time: string;
  unread: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string | null;
  hostId?: string;
  hostName?: string;
  hostAvatar?: string | null;
}

export function ChatModal({ open, onClose, listingId, listingTitle, listingImage, hostId, hostName, hostAvatar }: Props) {
  const store = useStore();
  const [view, setView] = useState<"list" | "chat">("list");
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [activeChatListingId, setActiveChatListingId] = useState<string>("");
  const [activeChatListingTitle, setActiveChatListingTitle] = useState<string>("");
  const [activeChatListingImage, setActiveChatListingImage] = useState<string | null>(null);
  const [activeChatOtherName, setActiveChatOtherName] = useState<string>("");
  const [activeChatOtherId, setActiveChatOtherId] = useState<string>("");
  const [activeChatOtherAvatar, setActiveChatOtherAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChats = async () => {
    try {
      const r = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getChatList", userId: store.user?.id }),
      });
      const j = await r.json();
      if (j.ok) setChats(j.data);
    } catch {}
  };

  const fetchMessages = async (lId: string, otherId: string) => {
    try {
      const r = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMessages", listingId: lId, userId: store.user?.id, otherId }),
      });
      const j = await r.json();
      if (j.ok) setMessages(j.data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!text.trim() || !store.user || !activeChatListingId || !activeChatOtherId) return;
    const msgText = text.trim();
    // Optimistic: show message immediately
    const tempId = "temp-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      listing_id: activeChatListingId,
      sender_id: store.user.id,
      receiver_id: activeChatOtherId,
      text: msgText,
      read: false,
      created_at: new Date().toISOString(),
      sender_name: store.user.name,
      sender_avatar: store.user.avatar || undefined,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setText("");
    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendMessage",
          listingId: activeChatListingId,
          senderId: store.user.id,
          senderName: store.user.name,
          receiverId: activeChatOtherId,
          text: msgText,
        }),
      });
      fetchMessages(activeChatListingId, activeChatOtherId);
      fetchChats();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const openChat = (c: ChatPreview) => {
    setView("chat");
    setActiveChatListingId(c.listing_id);
    setActiveChatListingTitle(c.listing_title);
    setActiveChatListingImage(c.listing_image);
    setActiveChatOtherId(c.other_id);
    setActiveChatOtherName(c.other_name);
    setActiveChatOtherAvatar(c.other_avatar);
    fetchMessages(c.listing_id, c.other_id);
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markMessagesRead", listingId: c.listing_id, userId: store.user?.id, otherId: c.other_id }),
    }).catch(() => {});
  };

  // Open chat directly if listingId given
  useEffect(() => {
    if (open && listingId && hostId) {
      setView("chat");
      setActiveChatListingId(listingId);
      setActiveChatListingTitle(listingTitle || "");
      setActiveChatListingImage(listingImage || null);
      setActiveChatOtherId(hostId);
      setActiveChatOtherName(hostName || "Организатор");
      setActiveChatOtherAvatar(hostAvatar || null);
      if (store.user) fetchMessages(listingId, hostId);
    } else if (open) {
      setView("list");
      if (store.user) fetchChats();
    }
  }, [open, listingId, hostId]);

  // Poll when in chat
  useEffect(() => {
    if (view === "chat" && activeChatListingId && activeChatOtherId) {
      pollRef.current = setInterval(() => fetchMessages(activeChatListingId, activeChatOtherId), 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, activeChatListingId, activeChatOtherId]);

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!store.user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
        {view === "list" ? (
          <>
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle className="font-display text-lg">Сообщения</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Нет сообщений. Напишите организатору объявления.
                </div>
              ) : (
                chats.map((c) => (
                  <button
                    key={`${c.listing_id}-${c.other_id}`}
                    onClick={() => openChat(c)}
                    className="w-full flex items-start gap-3 p-4 border-b hover:bg-muted/30 transition-colors text-left"
                  >
                    {/* Listing thumbnail with avatar overlay */}
                    <div className="w-12 h-12 shrink-0 relative rounded-lg overflow-hidden bg-muted">
                      {c.listing_image ? (
                        <img src={c.listing_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-accent/20 to-accent/10" />
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full border-2 border-white shadow-sm overflow-hidden bg-accent">
                        {c.other_avatar ? (
                          <img src={c.other_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-[9px] font-semibold">
                            {(c.other_name || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{c.other_name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.last_time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{c.listing_title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.last_message}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Chat header with listing context */}
            <div className="flex items-center gap-3 p-3 border-b shrink-0">
              <button onClick={() => { setView("list"); fetchChats(); }} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {activeChatListingImage ? (
                  <img src={activeChatListingImage} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{activeChatOtherName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {text ? "печатает..." : activeChatListingTitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {messages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground pt-8">Напишите первое сообщение</p>
              )}
              {messages.map((m) => {
                const isMine = m.sender_id === store.user?.id;
                const time = m.created_at
                  ? new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <div key={m.id} className={cn("flex items-start gap-2", isMine ? "justify-end flex-row-reverse" : "justify-start")}>
                    {/* Avatar */}
                    {isMine ? (
                      <Avatar className="w-8 h-8 shrink-0">
                        {store.user?.avatar ? (
                          <img src={store.user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="bg-accent/20 text-accent text-xs font-semibold">
                            {(store.user?.name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ) : (
                      <Avatar className="w-8 h-8 shrink-0">
                        {m.sender_avatar ? (
                          <img src={m.sender_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="bg-[#e4e6eb] text-xs font-semibold text-muted-foreground">
                            {(m.sender_name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}
                    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start", "max-w-[70%]")}>
                      <div className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed break-words",
                        isMine
                          ? "bg-[#e8f5e9] text-black rounded-br-[6px]"
                          : "bg-[#f0f2f5] text-black rounded-bl-[6px]"
                      )}>
                        {m.text}
                      </div>
                      <div className={cn("flex items-center gap-1 mt-0.5 px-0.5 text-[11px] text-muted-foreground", isMine ? "flex-row-reverse" : "")}>
                        <span>{time}</span>
                        {isMine && (
                          <span className={cn(m.read ? "text-[#2e89ff]" : "text-muted-foreground/50")}>
                            {m.read ? <CheckCheck className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t shrink-0 flex gap-2 bg-white">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Сообщение..."
                className="rounded-full h-10"
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />
              <Button size="icon" className="rounded-full shrink-0" onClick={sendMessage} disabled={!text.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
