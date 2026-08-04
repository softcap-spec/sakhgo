"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft, MessageCircle, X, CheckCheck } from "lucide-react";

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

export function ChatFAB() {
  const store = useStore();

  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [activeListingId, setActiveListingId] = useState("");
  const [activeListingTitle, setActiveListingTitle] = useState("");
  const [activeListingImage, setActiveListingImage] = useState<string | null>(null);
  const [activeOtherId, setActiveOtherId] = useState("");
  const [activeOtherName, setActiveOtherName] = useState("");
  const [activeOtherAvatar, setActiveOtherAvatar] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChats = () => {
    if (!store.user) return;
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getChatList", userId: store.user.id }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setChats(j.data);
          setUnreadTotal((j.data as any[]).reduce((s, c) => s + (c.unread || 0), 0));
        }
      })
      .catch(() => {});
  };

  const fetchMessages = (listingId: string, otherId: string) => {
    if (!store.user) return;
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getMessages", listingId, userId: store.user.id, otherId }),
    })
      .then(r => r.json())
      .then(j => { if (j.ok) setMessages(j.data); })
      .catch(() => {});
  };

  const sendMessage = () => {
    if (!text.trim() || !store.user || !activeListingId || !activeOtherId) return;
    const msgText = text.trim();
    // Optimistic: show message immediately
    const tempId = "temp-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      listing_id: activeListingId,
      sender_id: store.user.id,
      receiver_id: activeOtherId,
      text: msgText,
      read: false,
      created_at: new Date().toISOString(),
      sender_name: store.user.name,
      sender_avatar: store.user.avatar || undefined,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setText("");
    // Send to API
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sendMessage",
        listingId: activeListingId,
        senderId: store.user.id,
        senderName: store.user.name,
        receiverId: activeOtherId,
        text: msgText,
      }),
    }).then(() => {
      // Replace temp message with real one from server
      fetchMessages(activeListingId, activeOtherId);
      fetchChats();
    }).catch(() => {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
    });
  };

  const openChat = (c: ChatPreview) => {
    setView("chat");
    setActiveListingId(c.listing_id);
    setActiveListingTitle(c.listing_title);
    setActiveListingImage(c.listing_image);
    setActiveOtherId(c.other_id);
    setActiveOtherName(c.other_name);
    setActiveOtherAvatar(c.other_avatar);
    fetchMessages(c.listing_id, c.other_id);
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markMessagesRead", listingId: c.listing_id, userId: store.user?.id, otherId: c.other_id }),
    }).catch(() => {});
  };

  const startChatWith = (listingId: string, listingTitle: string, listingImage: string | null, hostId: string, hostName: string, hostAvatar?: string | null) => {
    setPanelOpen(true);
    setView("chat");
    setActiveListingId(listingId);
    setActiveListingTitle(listingTitle);
    setActiveListingImage(listingImage);
    setActiveOtherId(hostId);
    setActiveOtherName(hostName || "Организатор");
    setActiveOtherAvatar(hostAvatar || null);
    fetchMessages(listingId, hostId);
  };

  // Poll
  useEffect(() => {
    if (!store.user) {
      setUnreadTotal(0);
      return;
    }
    fetchChats();
    unreadRef.current = setInterval(fetchChats, 8000);
    return () => { if (unreadRef.current) clearInterval(unreadRef.current); };
  }, [store.user]);

  useEffect(() => {
    if (panelOpen && view === "chat" && activeListingId && activeOtherId) {
      pollRef.current = setInterval(() => fetchMessages(activeListingId, activeOtherId), 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [panelOpen, view, activeListingId, activeOtherId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Expose startChatWith for listing page usage
  useEffect(() => {
    (window as any).__sakhgoOpenChat = startChatWith;
    return () => { delete (window as any).__sakhgoOpenChat; };
  }, [store.user]);

  if (!store.user) return null;

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => { setPanelOpen(true); setView("list"); fetchChats(); }}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-accent text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        title="Сообщения"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>

      {/* Slide-in panel */}
      {panelOpen && (
        <div className="fixed bottom-0 right-0 z-[70] w-full sm:w-[400px] h-[520px] sm:bottom-6 sm:right-6 bg-white border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b shrink-0">
            {view === "chat" ? (
              <>
                <button onClick={() => { setView("list"); fetchChats(); }} className="shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {/* Listing context */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mx-2">
                  {activeListingImage ? (
                    <img src={activeListingImage} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{activeOtherName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {text ? "печатает..." : activeListingTitle}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <span className="font-display text-lg font-medium">Сообщения</span>
            )}
            <button onClick={() => setPanelOpen(false)} className="shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {view === "list" ? (
            /* Chat list */
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Нет сообщений. Перейдите в объявление и нажмите «Написать».
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
                      {/* Avatar pinned bottom-right */}
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
          ) : (
            /* Chat view */
            <>
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
                            ? "bg-[#e8f5e9] text-foreground rounded-br-[6px]"
                            : "bg-[#f0f2f5] text-foreground rounded-bl-[6px]"
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
        </div>
      )}
    </>
  );
}
