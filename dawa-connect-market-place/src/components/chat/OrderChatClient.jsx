"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, MessageCircle, Send, Store } from "lucide-react";

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(12_000).emit(event, payload, (error, response) => {
      if (error) return reject(new Error("The chat service did not respond. Please try again."));
      if (!response?.ok) return reject(Object.assign(new Error(response?.error || "Chat request failed."), { code: response?.code }));
      return resolve(response.data);
    });
  });
}

function mergeMessage(list, message) {
  if (!message?.id || list.some((item) => item.id === message.id)) return list;
  return [...list, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function timeLabel(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function OrderChatClient({ orderId }) {
  const socketRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const messagesRef = useRef(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionState, setConnectionState] = useState("connecting");
  const [error, setError] = useState("");

  const getToken = useCallback(async () => {
    const response = await fetch("/api/order-chat/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Live chat could not be opened.");
    return data;
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;

    async function startChat() {
      try {
        const credentials = await getToken();
        if (cancelled) return;
        const socket = io(credentials.serviceUrl, {
          auth: { token: credentials.token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 12,
        });
        socketRef.current = socket;

        socket.on("connect", async () => {
          if (cancelled) return;
          setConnectionState("connected");
          setError("");
          try {
            const opened = await emitWithAck(socket, "conversation:open", { orderId });
            const history = await emitWithAck(socket, "message:history", { conversationId: opened.id, limit: 50 });
            if (cancelled) return;
            setConversation(opened);
            setMessages(history.messages || []);
            await emitWithAck(socket, "message:read", { conversationId: opened.id });
          } catch (chatError) {
            if (!cancelled) setError(chatError.message);
          } finally {
            if (!cancelled) setLoading(false);
          }
        });

        socket.on("disconnect", () => {
          if (!cancelled) setConnectionState("reconnecting");
        });
        socket.on("connect_error", (connectError) => {
          if (!cancelled) {
            setConnectionState("offline");
            setError(connectError.message || "Unable to connect to live chat.");
            setLoading(false);
          }
        });
        socket.on("message:new", ({ message, conversation: updated }) => {
          if (!message || String(message.conversationId) !== String(updated?.id)) return;
          setConversation(updated);
          setMessages((current) => mergeMessage(current, message));
          void emitWithAck(socket, "message:read", { conversationId: updated.id }).catch(() => {});
        });
        socket.on("conversation:updated", (updated) => {
          setConversation((current) => current?.id === updated?.id ? { ...current, ...updated } : current);
        });

        refreshTimerRef.current = setInterval(async () => {
          try {
            const refreshed = await getToken();
            socket.auth = { token: refreshed.token };
          } catch {
            // The current connection remains valid; a visible error appears only if reconnection fails.
          }
        }, 12 * 60 * 1000);
      } catch (startError) {
        if (!cancelled) {
          setError(startError.message);
          setLoading(false);
          setConnectionState("offline");
        }
      }
    }

    startChat();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [getToken, orderId]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 180) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !conversation?.canSend || sending || !socketRef.current?.connected) return;
    setSending(true);
    setError("");
    try {
      const result = await emitWithAck(socketRef.current, "message:send", {
        conversationId: conversation.id,
        text,
        clientMessageId: crypto.randomUUID(),
      });
      setDraft("");
      setConversation(result.conversation);
      setMessages((current) => mergeMessage(current, result.message));
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/track/${encodeURIComponent(orderId)}`} className="mb-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950"><ArrowLeft className="h-4 w-4" /> Back to order</Link>
      <section className="flex min-h-[650px] flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-blue-950/5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-blue-950 via-blue-900 to-teal-800 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Store className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">Order #{orderId}</p>
              <h1 className="mt-1 text-xl font-bold">{conversation?.pharmacyName || "Pharmacy conversation"}</h1>
              <p className="mt-1 text-xs text-blue-100">Human support · No AI · Text messages only</p>
            </div>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {connectionState === "connected" ? "● Connected" : connectionState === "reconnecting" ? "Reconnecting…" : "Offline"}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening secure conversation…</div>
        ) : error && !conversation ? (
          <div className="m-auto max-w-md px-6 text-center"><MessageCircle className="mx-auto h-10 w-10 text-red-300" /><h2 className="mt-4 font-bold text-gray-900">Chat unavailable</h2><p className="mt-2 text-sm leading-6 text-red-600">{error}</p></div>
        ) : (
          <>
            <div ref={messagesRef} className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-6 sm:px-8">
              {messages.length === 0 && (
                <div className="mx-auto mt-16 max-w-md text-center text-gray-500">
                  <MessageCircle className="mx-auto h-10 w-10 text-blue-200" />
                  <h2 className="mt-4 font-bold text-gray-800">Start the order conversation</h2>
                  <p className="mt-2 text-sm leading-6">Ask the pharmacy about preparation, availability or delivery for this order.</p>
                </div>
              )}
              <div className="space-y-3">
                {messages.map((message) => {
                  const fromPharmacy = message.senderType === "pharmacy";
                  return (
                    <div key={message.id} className={`flex ${fromPharmacy ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[70%] ${fromPharmacy ? "rounded-bl-md border border-gray-200 bg-white text-gray-800" : "rounded-br-md bg-blue-800 text-white"}`}>
                        <p className="whitespace-pre-wrap break-words leading-6">{message.text}</p>
                        <p className={`mt-1.5 text-right text-[10px] ${fromPharmacy ? "text-gray-400" : "text-blue-200"}`}>{fromPharmacy ? "Pharmacy" : "You"} · {timeLabel(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!conversation?.canSend ? (
              <div className="border-t border-gray-200 bg-gray-50 px-6 py-5 text-center">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700"><CheckCircle2 className="h-4 w-4 text-teal-600" /> This order is {conversation?.orderStatus?.toLowerCase()}. The conversation is read-only.</p>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="border-t border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex items-end gap-3">
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(event); } }} rows={2} maxLength={2000} placeholder="Write a message to the pharmacy…" className="min-h-12 flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  <button type="submit" disabled={!draft.trim() || sending || connectionState !== "connected"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-400"><span className="inline-flex items-center gap-1"><LockKeyhole className="h-3 w-3" /> Only you and this pharmacy can access this order chat.</span><span>{draft.length}/2000</span></div>
                {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
