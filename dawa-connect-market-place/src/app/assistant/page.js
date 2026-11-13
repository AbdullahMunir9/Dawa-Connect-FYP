"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, Bot, Loader2, LockKeyhole, Sparkles, RotateCcw, Copy, Check, ShieldAlert, Pill, AlertTriangle, HelpCircle, Stethoscope, ArrowDown, ImagePlus, FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/components/ui";

/** ~24 characters/sec baseline; bursts when the network buffer is far ahead */
const TYPEWRITER_MS = 42;
const TYPEWRITER_BASE_STEP = 1;
const MAX_IMAGES_PER_MESSAGE = 2;
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 1_100_000;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const GREETING = { role: "assistant", content: "Hello! I'm the DawaConnect Virtual Assistant. Ask me about a medicine, its side effects, or how to use the platform — I'll keep the answer clear and remind you when a pharmacist or doctor should have the final say." };

const SUGGESTIONS = [
  { icon: Pill, title: "Dosage basics", prompt: "What is the usual adult dose of Panadol (paracetamol) and how many hours apart should I take it?" },
  { icon: AlertTriangle, title: "Side effects", prompt: "What are the common side effects of Augmentin and which ones mean I should stop and see a doctor?" },
  { icon: Stethoscope, title: "Interactions", prompt: "Can I take ibuprofen together with blood-pressure medicine? What should I watch out for?" },
  { icon: HelpCircle, title: "Using DawaConnect", prompt: "How do I track an order that was split between two pharmacies on DawaConnect?" },
];

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be compressed."))),
      "image/jpeg",
      quality,
    );
  });
}

async function prepareImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG and WebP images can be attached.");
  }
  if (!file.size || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 12 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image is damaged or unsupported."));
      element.src = objectUrl;
    });
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / Math.max(1, longestSide));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let blob = await canvasToJpeg(canvas, quality);
    while (blob.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.42) {
      quality -= 0.08;
      blob = await canvasToJpeg(canvas, quality);
    }
    if (blob.size > MAX_COMPRESSED_IMAGE_BYTES) {
      throw new Error("This image remains too large after compression. Choose a smaller image.");
    }
    return {
      id: `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      mimeType: "image/jpeg",
      dataUrl: await readBlobAsDataUrl(blob),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function displayMarkdown(content, streaming = false) {
  let text = String(content || "")
    .split("\n")
    .flatMap((line) => {
      const trimmed = line.trim();
      if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) return [];
      if (trimmed.startsWith("|")) {
        const cells = trimmed.split("|").slice(1).map((cell) => cell.trim()).filter(Boolean);
        if (!cells.length) return [];
        return [`- ${cells.map((cell, index) => index === 0 ? `**${cell.replace(/^\*\*|\*\*$/g, "")}**` : cell).join(": ")}`];
      }
      return [line];
    })
    .join("\n");

  // During character-by-character playback, close a temporarily incomplete
  // bold marker so ReactMarkdown never exposes raw ** characters to the user.
  if (streaming && (text.match(/\*\*/g) || []).length % 2 !== 0) text += "**";
  return text;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 group-hover:opacity-100" aria-label="Copy answer">
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}
    </button>
  );
}

function QuotaMeter({ quota }) {
  if (!quota) return null;
  const used = Math.max(0, quota.limit - quota.remaining);
  const pct = quota.limit ? Math.min(100, Math.round((used / quota.limit) * 100)) : 0;
  const imageLimit = quota.imageLimit || 6;
  const imagesUsed = Math.max(0, quota.imagesUsed || 0);
  const imagePct = Math.min(100, Math.round((imagesUsed / imageLimit) * 100));
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs"><span className="font-semibold text-gray-700">Today's questions</span><span className="tabular-nums text-gray-500">{used} / {quota.limit}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${pct}%` }} /></div>
        <p className="mt-1.5 text-[11px] text-gray-500">{quota.remaining === 0 ? "Limit reached — resets at midnight (PKT)." : `${quota.remaining} remaining · resets daily`}</p>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs"><span className="font-semibold text-gray-700">Today's images</span><span className="tabular-nums text-gray-500">{imagesUsed} / {imageLimit}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={cn("h-full rounded-full transition-all", imagePct >= 100 ? "bg-red-500" : imagePct >= 67 ? "bg-amber-500" : "bg-violet-600")} style={{ width: `${imagePct}%` }} /></div>
        <p className="mt-1.5 text-[11px] text-gray-500">{quota.imagesRemaining === 0 ? "Image limit reached — text questions still work." : `${quota.imagesRemaining} image uploads remaining`}</p>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [imageError, setImageError] = useState("");
  const [prescriptionPickerOpen, setPrescriptionPickerOpen] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [quota, setQuota] = useState(null);
  const messagesViewportRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  /** Full text received from the API stream (may run ahead of what we show). */
  const streamTargetRef = useRef("");
  const streamReadDoneRef = useRef(false);
  const typewriterIntervalRef = useRef(null);

  const clearTypewriter = useCallback(() => {
    if (typewriterIntervalRef.current != null) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTypewriter(), [clearTypewriter]);

  useEffect(() => {
    if (!user) { setQuota(null); return; }
    let cancelled = false;
    fetch("/api/chat", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Could not load AI usage."); return response.json(); })
      .then((data) => { if (!cancelled) setQuota(data); })
      .catch(() => { if (!cancelled) setQuota(null); });
    return () => { cancelled = true; };
  }, [user]);

  // Auto-grow the composer up to ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const startTypewriterPump = useCallback(() => {
    clearTypewriter();
    typewriterIntervalRef.current = setInterval(() => {
      const target = streamTargetRef.current;
      const readerDone = streamReadDoneRef.current;
      let shouldStop = false;
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx < 0 || next[lastIdx]?.role !== "assistant") return prev;
        const curLen = next[lastIdx].content.length;
        const backlog = target.length - curLen;
        if (backlog <= 0) { if (readerDone) shouldStop = true; return prev; }
        let step = TYPEWRITER_BASE_STEP;
        if (backlog > 240) step = Math.min(12, Math.max(3, Math.floor(backlog / 28)));
        else if (backlog > 96) step = Math.min(5, Math.max(2, Math.floor(backlog / 48)));
        const newLen = Math.min(curLen + step, target.length);
        next[lastIdx] = { role: "assistant", content: target.slice(0, newLen) };
        if (readerDone && newLen >= target.length) shouldStop = true;
        return next;
      });
      if (shouldStop) { clearTypewriter(); setIsLoading(false); }
    }, TYPEWRITER_MS);
  }, [clearTypewriter]);

  const handleImageSelection = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const availableToday = quota?.imagesRemaining ?? 6;
    const availableInMessage = MAX_IMAGES_PER_MESSAGE - pendingImages.length;
    const acceptedCount = Math.min(availableToday, availableInMessage);
    if (acceptedCount <= 0) {
      setImageError(
        availableToday <= 0
          ? "You have used today's 6 image uploads. You can still ask text questions."
          : "A message can contain no more than 2 images.",
      );
      return;
    }
    if (files.length > acceptedCount) {
      setImageError(
        availableToday < files.length
          ? `Only ${availableToday} image upload${availableToday === 1 ? "" : "s"} remain today.`
          : "A message can contain no more than 2 images.",
      );
      return;
    }

    setImageError("");
    setIsPreparingImages(true);
    try {
      const prepared = [];
      for (const file of files) prepared.push(await prepareImage(file));
      setPendingImages((current) => [...current, ...prepared]);
    } catch (error) {
      setImageError(error?.message || "The selected image could not be prepared.");
    } finally {
      setIsPreparingImages(false);
    }
  }, [pendingImages.length, quota?.imagesRemaining]);

  const removePendingImage = useCallback((imageId) => {
    setPendingImages((current) => current.filter((image) => image.id !== imageId));
    setImageError("");
  }, []);

  const openPrescriptionPicker = useCallback(async () => {
    if (pendingImages.length >= MAX_IMAGES_PER_MESSAGE || quota?.imagesRemaining === 0) return;
    setPrescriptionPickerOpen(true);
    setPrescriptionsLoading(true);
    setImageError("");
    try {
      const response = await fetch("/api/prescriptions", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Prescriptions could not be loaded.");
      setPrescriptions((data.prescriptions || []).filter((prescription) => prescription.available));
    } catch (error) {
      setImageError(error.message || "Prescriptions could not be loaded.");
      setPrescriptionPickerOpen(false);
    } finally { setPrescriptionsLoading(false); }
  }, [pendingImages.length, quota?.imagesRemaining]);

  const choosePrescription = useCallback(async (prescription) => {
    if (pendingImages.length >= MAX_IMAGES_PER_MESSAGE) return setImageError("A message can contain no more than 2 images.");
    if ((quota?.imagesRemaining ?? 6) <= 0) return setImageError("You have used today's 6 image uploads. You can still ask text questions.");
    setIsPreparingImages(true); setImageError("");
    try {
      const response = await fetch(prescription.previewUrl, { cache: "no-store" });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "This prescription preview could not be loaded."); }
      const blob = await response.blob();
      const prepared = await prepareImage(new File([blob], `${prescription.title}.jpg`, { type: "image/jpeg" }));
      setPendingImages((current) => [...current, { ...prepared, sourcePrescriptionId: prescription._id }]);
      setPrescriptionPickerOpen(false);
    } catch (error) { setImageError(error.message || "This prescription could not be attached."); }
    finally { setIsPreparingImages(false); }
  }, [pendingImages.length, quota?.imagesRemaining]);

  const sendMessage = useCallback(async (text) => {
    const content = text.trim();
    if (!user || !content || isLoading || isPreparingImages || quota?.remaining === 0) return;
    if (pendingImages.length > (quota?.imagesRemaining ?? 6)) {
      setImageError("Your remaining daily image allowance is too low for these attachments.");
      return;
    }
    const attachments = pendingImages.map(({ id, name, mimeType, dataUrl }) => ({
      id,
      name,
      mimeType,
      dataUrl,
    }));
    const userMessage = { role: "user", content, images: attachments };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setImageError("");
    setIsLoading(true);
    clearTypewriter();
    streamTargetRef.current = "";
    streamReadDoneRef.current = false;

    try {
      const requestMessages = newMessages.map((message, index) => ({
        role: message.role,
        content: message.content,
        ...(index === newMessages.length - 1 && message.images?.length
          ? { images: message.images.map(({ dataUrl }) => ({ dataUrl })) }
          : {}),
      }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: requestMessages }) });
      if (!response.ok) {
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const errorPayload = isJson ? await response.json() : { message: await response.text() };
        if (typeof errorPayload.remaining === "number") setQuota((current) => ({ ...(current || {}), ...errorPayload }));
        throw new Error(errorPayload.message || "Failed to fetch response");
      }
      const remainingHeader = response.headers.get("X-AI-Remaining");
      if (remainingHeader !== null) {
        const imageRemainingHeader = response.headers.get("X-AI-Image-Remaining");
        setQuota((current) => ({
          ...(current || { limit: 20, imageLimit: 6 }),
          remaining: Number(remainingHeader),
          used: Number(response.headers.get("X-AI-Limit") || 20) - Number(remainingHeader),
          ...(imageRemainingHeader !== null
            ? {
                imagesRemaining: Number(imageRemainingHeader),
                imagesUsed: Number(response.headers.get("X-AI-Image-Limit") || 6) - Number(imageRemainingHeader),
              }
            : {}),
        }));
      }
      if (!response.body) throw new Error("No response body");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      startTypewriterPump();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        streamTargetRef.current = accumulated;
      }
      streamReadDoneRef.current = true;
      if (accumulated.length === 0) { clearTypewriter(); setIsLoading(false); }
    } catch (error) {
      console.error("Chat error:", error);
      streamReadDoneRef.current = true;
      clearTypewriter();
      const fallback = error.message || "I'm sorry, I encountered an error while processing your request. Please try again.";
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx]?.role === "assistant" && next[lastIdx].content === "") { next[lastIdx] = { role: "assistant", content: fallback }; return next; }
        return [...next, { role: "assistant", content: fallback }];
      });
      setIsLoading(false);
    }
  }, [user, isLoading, isPreparingImages, quota, pendingImages, messages, clearTypewriter, startTypewriterPump]);

  const handleSubmit = (e) => { e.preventDefault(); void sendMessage(input); };
  const onKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } };
  const resetConversation = () => { if (isLoading) return; clearTypewriter(); setMessages([GREETING]); setInput(""); setPendingImages([]); setImageError(""); };
  const jumpToLatest = () => {
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  };

  if (authLoading) {
    return <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-700" aria-label="Checking session" /></div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 px-4 py-12">
        <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white text-center shadow-sm">
          <div className="bg-gradient-to-br from-violet-700 via-blue-800 to-blue-900 px-8 py-10 text-white">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Bot className="h-7 w-7" /></span>
            <h1 className="mt-5 text-2xl font-bold">DawaConnect AI Assistant</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-blue-100">Plain-language answers about medicines, side effects and using the marketplace — for signed-in members.</p>
          </div>
          <div className="px-8 py-8">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"><LockKeyhole className="h-4 w-4 text-blue-700" /> Sign in to start a conversation</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login?next=/assistant" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Sign in</Link>
              <Link href="/signup?next=/assistant" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Create an account</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isFresh = messages.length === 1;
  const limitReached = quota?.remaining === 0;

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* ------------------------------ Sidebar ------------------------------ */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl bg-gradient-to-br from-violet-700 via-blue-800 to-blue-900 p-5 text-white shadow-lg shadow-blue-900/15">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Bot className="h-6 w-6" /></span>
                <div><p className="font-bold leading-tight">DawaConnect AI</p><p className="text-xs text-blue-100">Virtual pharmacist &amp; guide</p></div>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-blue-100">Educational guidance on medicines and the platform. Not a diagnosis, not a prescription.</p>
              <button type="button" onClick={resetConversation} disabled={isLoading || isFresh} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/20 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> New conversation</button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <QuotaMeter quota={quota} />
              {!quota && <p className="text-xs text-gray-500">Up to 20 questions and 6 image uploads per day.</p>}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4" /> In an emergency</p>
              <p className="mt-1 text-xs leading-5">Severe symptoms, overdose or allergic reaction: contact local emergency services or go to the nearest hospital. Don't wait for an AI answer.</p>
            </div>
          </aside>

          {/* ------------------------------ Chat ------------------------------ */}
          <section className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Conversation">
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="relative grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-700"><Bot className="h-5 w-5" /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" /></span>
                <div><p className="text-sm font-semibold text-gray-900">Assistant</p><p className="text-[11px] text-gray-500">{isLoading ? "Typing…" : "Online · answers in seconds"}</p></div>
              </div>
              {quota && <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", limitReached ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600")}>{quota.remaining} left today</span>}
            </header>

            <div ref={messagesViewportRef} data-testid="messages-viewport" className="relative flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.05),transparent_60%)] px-4 py-5 sm:px-6">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                const streaming = isLoading && !isUser && index === messages.length - 1;
                return (
                  <div key={index} className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                    <span className={cn("mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold", isUser ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-700")}>{isUser ? initials(user.name) : <Bot className="h-4 w-4" />}</span>
                    <div className={cn("max-w-[85%] sm:max-w-[75%]", isUser ? "items-end" : "items-start")}>
                      <div className={cn("rounded-2xl px-4 py-3 text-[14px] leading-relaxed", isUser ? "rounded-tr-md bg-blue-700 text-white" : "rounded-tl-md border border-gray-200 bg-white text-gray-800 shadow-sm")}>
                        {isUser ? (
                          <>
                            {msg.images?.length > 0 && (
                              <div className={cn("mb-2 grid gap-2", msg.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                                {msg.images.map((image, imageIndex) => (
                                  <img key={image.id || imageIndex} src={image.dataUrl} alt={`Attached image ${imageIndex + 1}`} className="max-h-48 w-full rounded-xl bg-white/10 object-cover ring-1 ring-white/25" />
                                ))}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </>
                        ) : streaming ? (
                          msg.content ? <div className="md-answer"><ReactMarkdown skipHtml>{displayMarkdown(msg.content, true)}</ReactMarkdown><span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-sm bg-blue-600" aria-hidden /></div>
                            : <span className="inline-flex items-center gap-1.5 text-gray-400"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" /></span>
                        ) : (
                          <div className="md-answer"><ReactMarkdown skipHtml>{displayMarkdown(msg.content)}</ReactMarkdown></div>
                        )}
                      </div>
                      {!isUser && !streaming && index > 0 && <div className="mt-1 flex justify-start"><CopyButton text={msg.content} /></div>}
                    </div>
                  </div>
                );
              })}

              {isFresh && !isLoading && (
                <div className="mx-auto max-w-2xl pt-4">
                  <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Start with a question</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s.title} type="button" onClick={() => void sendMessage(s.prompt)} disabled={limitReached} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:opacity-50">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><s.icon className="h-4 w-4" /></span>
                        <span><span className="block text-sm font-semibold text-gray-900">{s.title}</span><span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-gray-500">{s.prompt}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Bot className="h-4 w-4" /></span><div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div></div>
              )}
              {messages.length > 1 && (
                <button type="button" onClick={jumpToLatest} className="sticky bottom-1 ml-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-md backdrop-blur transition hover:border-blue-200 hover:text-blue-700" aria-label="Jump to the latest message">
                  <ArrowDown className="h-3.5 w-3.5" /> Latest
                </button>
              )}
            </div>

            <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
              {limitReached && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">You've used today's {quota.limit} questions. The limit resets at midnight.</p>}
              {imageError && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{imageError}</p>}
              <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-gray-50 p-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 px-2 pb-2">
                    {pendingImages.map((image, index) => (
                      <div key={image.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <img src={image.dataUrl} alt={`Selected image ${index + 1}`} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => removePendingImage(image.id)} disabled={isLoading} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-gray-950/75 text-white transition hover:bg-red-600 disabled:opacity-50" aria-label={`Remove image ${index + 1}`}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageSelection} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isPreparingImages || limitReached || pendingImages.length >= MAX_IMAGES_PER_MESSAGE || quota?.imagesRemaining === 0} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Attach up to two images" title="Attach images">
                    {isPreparingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => void openPrescriptionPicker()} disabled={isLoading || isPreparingImages || limitReached || pendingImages.length >= MAX_IMAGES_PER_MESSAGE || quota?.imagesRemaining === 0} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-500 transition hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Select a saved prescription" title="Select saved prescription"><FileText className="h-4 w-4" /></button>
                  <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={isLoading || limitReached} maxLength={2000}
                    placeholder={limitReached ? "Daily question limit reached" : pendingImages.length ? "Ask a health question about the selected image…" : "Ask about a medicine, a side effect, or how DawaConnect works…"}
                    className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed" aria-label="Message the assistant" />
                  <button type="submit" disabled={!input.trim() || isLoading || isPreparingImages || limitReached} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white transition hover:bg-blue-800 disabled:opacity-40 disabled:hover:bg-blue-700" aria-label="Send">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <p className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-gray-400"><span>Images and saved prescriptions share the 2-per-message · 6-per-day limit</span><span className="hidden sm:inline">General information only — not medical advice.</span></p>
            </div>
          </section>
        </div>
      </div>
      {prescriptionPickerOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="prescription-picker-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrescriptionPickerOpen(false); }}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4"><div><h2 id="prescription-picker-title" className="font-bold text-gray-950">Choose a saved prescription</h2><p className="mt-0.5 text-sm text-gray-500">Preview it here, then attach its first page to your next question.</p></div><button type="button" onClick={() => setPrescriptionPickerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 hover:bg-gray-100" aria-label="Close prescription picker"><X className="h-5 w-5" /></button></div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {prescriptionsLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-blue-700" /></div> : prescriptions.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center"><FileText className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 font-semibold text-gray-900">No saved prescriptions</p><p className="mt-1 text-sm text-gray-500">Upload one in your user portal first.</p><Link href="/dashboard/prescriptions" className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Manage prescriptions</Link></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{prescriptions.map((prescription) => <button key={prescription._id} type="button" onClick={() => void choosePrescription(prescription)} disabled={isPreparingImages} className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:opacity-50"><div className="h-36 bg-gray-100"><img src={prescription.previewUrl} alt={`Preview of ${prescription.title}`} className="h-full w-full object-cover" /></div><div className="p-3"><p className="truncate text-sm font-semibold text-gray-900">{prescription.title}</p><p className="mt-1 truncate text-xs text-gray-500">{prescription.fileName}</p><span className="mt-3 inline-flex text-xs font-semibold text-blue-700">Select prescription</span></div></button>)}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
