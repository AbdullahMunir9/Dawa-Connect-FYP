"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { ArrowLeft, CheckCircle2, Clock3, ImagePlus, Loader2, LockKeyhole, MessageCircle, Send, Store, UserPlus, X } from "lucide-react";

const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const CHAT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const imageInputRef = useRef(null);
  const chatCredentialsRef = useRef({ token: "", serviceUrl: "" });
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [openImage, setOpenImage] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const [error, setError] = useState("");
  const [chatAccess, setChatAccess] = useState({ role: null, guestHistoryExpiresAt: null, retentionDays: null });

  const getToken = useCallback(async () => {
    const response = await fetch("/api/order-chat/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ orderId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(data.message || "Live chat could not be opened."), {
        code: data.code || "CHAT_TOKEN_FAILED",
      });
    }
    return data;
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;

    async function startChat() {
      try {
        const credentials = await getToken();
        if (cancelled) return;
        chatCredentialsRef.current = { token: credentials.token, serviceUrl: credentials.serviceUrl };
        setChatAccess({
          role: credentials.role || null,
          guestHistoryExpiresAt: credentials.guestHistoryExpiresAt || null,
          retentionDays: credentials.guestHistoryRetentionDays || null,
        });
        const socket = io(credentials.serviceUrl, {
          auth: { token: credentials.token },
          // Start with HTTP long-polling, which works reliably through Vercel,
          // DNS proxies and Render, then let Socket.IO upgrade to WebSocket.
          transports: ["polling", "websocket"],
          timeout: 20_000,
          reconnection: true,
          reconnectionAttempts: 30,
          reconnectionDelayMax: 5_000,
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
            const code = connectError?.data?.code;
            setError(code === "CHAT_AUTH_FAILED"
              ? "Your chat session expired. Refresh the page and try again."
              : code === "CHAT_NOT_CONFIGURED"
                ? "Live chat is not configured on the server."
                : "The live chat server is waking up or temporarily unavailable. Reconnecting automatically…");
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
            chatCredentialsRef.current = { token: refreshed.token, serviceUrl: refreshed.serviceUrl };
            if (!cancelled) {
              setChatAccess({
                role: refreshed.role || null,
                guestHistoryExpiresAt: refreshed.guestHistoryExpiresAt || null,
                retentionDays: refreshed.guestHistoryRetentionDays || null,
              });
            }
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

  useEffect(() => {
    if (chatAccess.role !== "guest" || !chatAccess.guestHistoryExpiresAt) return undefined;
    const expiresAt = new Date(chatAccess.guestHistoryExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return undefined;

    const expireGuestChat = () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setMessages([]);
      setConversation(null);
      setConnectionState("offline");
      setError("This guest order chat expired after 15 days. Its history has been permanently removed.");
    };

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expireGuestChat();
      return undefined;
    }
    const timer = setTimeout(expireGuestChat, remaining);
    return () => clearTimeout(timer);
  }, [chatAccess.guestHistoryExpiresAt, chatAccess.role]);

  const uploadOneImage = async (file) => {
    const { token, serviceUrl } = chatCredentialsRef.current;
    const grantResponse = await fetch(`${serviceUrl}/api/chat/conversations/${encodeURIComponent(conversation.id)}/image-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const grantData = await grantResponse.json().catch(() => ({}));
    if (!grantResponse.ok || !grantData.upload) throw new Error(grantData.message || "The image upload could not be started.");

    const grant = grantData.upload;
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", grant.apiKey);
    form.append("timestamp", String(grant.timestamp));
    form.append("public_id", grant.publicId);
    form.append("overwrite", "false");
    form.append("signature", grant.signature);
    const uploadResponse = await fetch(grant.uploadUrl, { method: "POST", body: form });
    const uploaded = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploaded.secure_url || !uploaded.signature) {
      throw new Error(uploaded?.error?.message || "The image could not be uploaded.");
    }
    return {
      publicId: uploaded.public_id,
      version: uploaded.version,
      uploadSignature: uploaded.signature,
      format: uploaded.format,
      bytes: uploaded.bytes,
      width: uploaded.width,
      height: uploaded.height,
      previewUrl: uploaded.secure_url,
    };
  };

  const selectImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (pendingAttachments.length + files.length > 2) {
      setError("You can attach at most 2 images to one message.");
      return;
    }
    const invalid = files.find((file) => !CHAT_IMAGE_TYPES.has(file.type) || file.size > CHAT_IMAGE_MAX_BYTES);
    if (invalid) {
      setError("Choose JPEG, PNG, or WebP images that are 5 MB or smaller.");
      return;
    }
    setUploadingImages(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadOneImage(file));
      setPendingAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadingImages(false);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || !conversation?.canSend || sending || uploadingImages || !socketRef.current?.connected) return;
    setSending(true);
    setError("");
    try {
      const result = await emitWithAck(socketRef.current, "message:send", {
        conversationId: conversation.id,
        text,
        attachments: pendingAttachments.map(({ previewUrl, ...attachment }) => attachment),
        clientMessageId: crypto.randomUUID(),
      });
      setDraft("");
      setPendingAttachments([]);
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
              <p className="mt-1 text-xs text-blue-100">Human support · No AI · Text and image messages</p>
            </div>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {connectionState === "connected" ? "● Connected" : connectionState === "reconnecting" ? "Reconnecting…" : "Offline"}
          </div>
        </header>

        {chatAccess.role === "guest" && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 sm:px-6">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="min-w-0 text-sm leading-6">
                <p className="font-semibold">Guest chat history is temporary.</p>
                <p className="text-amber-900/90">
                  This conversation will be permanently removed {chatAccess.guestHistoryExpiresAt
                    ? `on ${new Date(chatAccess.guestHistoryExpiresAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}`
                    : `after ${chatAccess.retentionDays || 15} days`}.
                  {" "}Create an account and sign in before placing future orders to keep their chat history permanently.
                </p>
                <Link href="/signup" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-blue-800 hover:text-blue-950">
                  <UserPlus className="h-4 w-4" /> Create an account
                </Link>
              </div>
            </div>
          </div>
        )}

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
                        {message.attachments?.length > 0 && (
                          <div className={`mb-2 grid gap-2 ${message.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                            {message.attachments.map((attachment) => (
                              <button key={attachment.publicId} type="button" onClick={() => setOpenImage(attachment)} className="overflow-hidden rounded-xl bg-black/5 text-left" aria-label="Open chat image">
                                <img src={attachment.thumbnailUrl || attachment.url} alt="Chat attachment" className="max-h-64 w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                        {message.text && <p className="whitespace-pre-wrap break-words leading-6">{message.text}</p>}
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
                {pendingAttachments.length > 0 && (
                  <div className="mb-3 flex gap-3">
                    {pendingAttachments.map((attachment, index) => (
                      <div key={attachment.publicId} className="relative h-20 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <img src={attachment.previewUrl} alt={`Selected attachment ${index + 1}`} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setPendingAttachments((current) => current.filter((item) => item.publicId !== attachment.publicId))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black" aria-label="Remove image"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3">
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={selectImages} />
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImages || sending || pendingAttachments.length >= 2} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Attach images">{uploadingImages ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}</button>
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(event); } }} rows={2} maxLength={2000} placeholder="Write a message to the pharmacy…" className="min-h-12 flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  <button type="submit" disabled={(!draft.trim() && pendingAttachments.length === 0) || sending || uploadingImages || connectionState !== "connected"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-400"><span className="inline-flex items-center gap-1"><LockKeyhole className="h-3 w-3" /> Private chat · Up to 2 images per message · 5 MB each</span><span>{draft.length}/2000</span></div>
                {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
              </form>
            )}
          </>
        )}
      </section>
      {openImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Chat image preview" onClick={() => setOpenImage(null)}>
          <button type="button" onClick={() => setOpenImage(null)} className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25" aria-label="Close image"><X className="h-6 w-6" /></button>
          <img src={openImage.url} alt="Chat attachment full size" className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </main>
  );
}
