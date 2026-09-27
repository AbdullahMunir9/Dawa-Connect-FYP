"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, Bot, Loader2, LockKeyhole, Sparkles, RotateCcw, Copy, Check, ShieldAlert, Pill, AlertTriangle, HelpCircle, Stethoscope, Zap, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/components/ui";

/** ~24 characters/sec baseline; bursts when the network buffer is far ahead */
const TYPEWRITER_MS = 42;
const TYPEWRITER_BASE_STEP = 1;

const GREETING = { role: "assistant", content: "Hello! I'm the DawaConnect Virtual Assistant. Ask me about a medicine, its side effects, or how to use the platform — I'll keep the answer clear and remind you when a pharmacist or doctor should have the final say." };

const SUGGESTIONS = [
  { icon: Pill, title: "Dosage basics", prompt: "What is the usual adult dose of Panadol (paracetamol) and how many hours apart should I take it?" },
  { icon: AlertTriangle, title: "Side effects", prompt: "What are the common side effects of Augmentin and which ones mean I should stop and see a doctor?" },
  { icon: Stethoscope, title: "Interactions", prompt: "Can I take ibuprofen together with blood-pressure medicine? What should I watch out for?" },
  { icon: HelpCircle, title: "Using DawaConnect", prompt: "How do I track an order that was split between two pharmacies on DawaConnect?" },
];

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
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="font-semibold text-gray-700">Today's questions</span><span className="tabular-nums text-gray-500">{used} / {quota.limit}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${pct}%` }} /></div>
      <p className="mt-1.5 text-[11px] text-gray-500">{quota.remaining === 0 ? "Limit reached — resets at midnight (PKT)." : `${quota.remaining} remaining · resets daily`}</p>
    </div>
  );
}

export default function AssistantPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quota, setQuota] = useState(null);
  const messagesViewportRef = useRef(null);
  const textareaRef = useRef(null);

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

  const sendMessage = useCallback(async (text) => {
    const content = text.trim();
    if (!user || !content || isLoading || quota?.remaining === 0) return;
    const userMessage = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    clearTypewriter();
    streamTargetRef.current = "";
    streamReadDoneRef.current = false;

    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMessages }) });
      if (!response.ok) {
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const errorPayload = isJson ? await response.json() : { message: await response.text() };
        if (typeof errorPayload.remaining === "number") setQuota((current) => ({ ...(current || {}), ...errorPayload }));
        throw new Error(errorPayload.message || "Failed to fetch response");
      }
      const remainingHeader = response.headers.get("X-AI-Remaining");
      if (remainingHeader !== null) {
        setQuota((current) => ({ ...(current || { limit: 20 }), remaining: Number(remainingHeader), used: Number(response.headers.get("X-AI-Limit") || 20) - Number(remainingHeader) }));
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
  }, [user, isLoading, quota, messages, clearTypewriter, startTypewriterPump]);

  const handleSubmit = (e) => { e.preventDefault(); void sendMessage(input); };
  const onKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } };
  const resetConversation = () => { if (isLoading) return; clearTypewriter(); setMessages([GREETING]); setInput(""); };
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
              {!quota && <p className="text-xs text-gray-500">Up to 20 questions per day.</p>}
            </div>

            <div className="hidden rounded-2xl border border-gray-200 bg-white p-5 lg:block">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Zap className="h-4 w-4 text-amber-500" /> Try asking</p>
              <ul className="mt-3 space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <li key={s.title}><button type="button" onClick={() => void sendMessage(s.prompt)} disabled={isLoading || limitReached} className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-gray-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"><s.icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span><span className="block font-semibold">{s.title}</span><span className="line-clamp-2 text-xs text-gray-500">{s.prompt}</span></span></button></li>
                ))}
              </ul>
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
                        {isUser ? <p className="whitespace-pre-wrap">{msg.content}</p> : streaming ? (
                          msg.content ? <p className="whitespace-pre-wrap">{msg.content}<span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-sm bg-blue-600" aria-hidden /></p>
                            : <span className="inline-flex items-center gap-1.5 text-gray-400"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" /></span>
                        ) : (
                          <div className="md-answer"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
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
              <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={isLoading || limitReached} maxLength={2000}
                  placeholder={limitReached ? "Daily question limit reached" : "Ask about a medicine, a side effect, or how DawaConnect works…"}
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed" aria-label="Message the assistant" />
                <button type="submit" disabled={!input.trim() || isLoading || limitReached} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white transition hover:bg-blue-800 disabled:opacity-40 disabled:hover:bg-blue-700" aria-label="Send">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              <p className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-gray-400"><span><kbd className="rounded border border-gray-200 bg-white px-1">Enter</kbd> to send · <kbd className="rounded border border-gray-200 bg-white px-1">Shift</kbd>+<kbd className="rounded border border-gray-200 bg-white px-1">Enter</kbd> for a new line</span><span className="hidden sm:inline">General information only — not medical advice.</span></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
