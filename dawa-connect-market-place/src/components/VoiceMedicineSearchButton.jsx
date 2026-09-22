"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Loader2, Square } from "lucide-react";
import { recordSearchAndNavigate } from "@/lib/searchNavigation";

/**
 * Speech → Groq extracts medicine intent → /search?q=…
 * Uses Web Speech API (Chrome / Edge typically; HTTPS required on real devices).
 */
export default function VoiceMedicineSearchButton({
  className = "",
  size = "md",
  label = "Search by voice",
  compact = false,
}) {
  const router = useRouter();
  const [phase, setPhase] = useState("idle"); // idle | listening | resolving
  const [hint, setHint] = useState("");
  const recogRef = useRef(null);
  const listeningRef = useRef(false);

  const iconCls = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const btnPad = size === "sm" ? "p-1.5" : size === "lg" ? "p-3" : "p-2";

  const cleanupRecognition = useCallback(() => {
    try {
      recogRef.current?.abort?.();
      recogRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recogRef.current = null;
    listeningRef.current = false;
  }, []);

  useEffect(() => () => cleanupRecognition(), [cleanupRecognition]);

  const resolveIntentAndGo = useCallback(
    async (transcript) => {
      const said = String(transcript ?? "").trim();
      if (!said) {
        setHint("No speech detected.");
        setPhase("idle");
        return;
      }
      setPhase("resolving");
      setHint("");
      try {
        const res = await fetch("/api/voice-search-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: said }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.message || "Could not interpret request");
        }

        const query = typeof data.query === "string" ? data.query.trim() : "";

        if (!query) {
          setHint(`Heard “${said.slice(0, 60)}…” — couldn't find a clear medicine to search. Try again more specifically.`);
          setPhase("idle");
          return;
        }

        await recordSearchAndNavigate(router, query);
        setPhase("idle");
        setHint("");
      } catch (e) {
        console.error(e);
        setHint(e.message || "Voice search failed. Try typing instead.");
        setPhase("idle");
      }
    },
    [router]
  );

  const startListening = useCallback(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setHint("Voice search isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    cleanupRecognition();

    const recog = new SR();
    recog.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    recog.continuous = false;
    recog.interimResults = false;

    recog.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) void resolveIntentAndGo(text);
    };

    recog.onerror = (event) => {
      listeningRef.current = false;
      const code = event.error;
      if (code === "aborted") {
        setPhase("idle");
        return;
      }
      if (code === "no-speech") setHint("No speech heard. Tap again and speak.");
      else if (code === "not-allowed") setHint("Microphone blocked. Allow mic for this site in browser settings.");
      else setHint(`Voice error: ${code}`);
      setPhase("idle");
    };

    recog.onend = () => {
      listeningRef.current = false;
      // If we didn't get onresult → resolving stays false; bounce to idle handled by onresult path
      setPhase((prev) => (prev === "listening" ? "idle" : prev));
      recogRef.current = null;
    };

    recogRef.current = recog;
    listeningRef.current = true;
    setHint("");
    setPhase("listening");
    try {
      recog.start();
    } catch (e) {
      console.error(e);
      setHint("Could not start microphone.");
      setPhase("idle");
    }
  }, [cleanupRecognition, resolveIntentAndGo]);

  const toggle = useCallback(() => {
    setHint("");
    if (phase === "listening") {
      cleanupRecognition();
      setPhase("idle");
      return;
    }
    if (phase === "resolving") return;
    startListening();
  }, [phase, cleanupRecognition, startListening]);

  const showStop = phase === "listening";
  const title =
    [hint, phase === "listening" ? "Listening…" : "", phase === "resolving" ? "Finding medicine…" : ""]
      .filter(Boolean)
      .join(" ") || label;

  return (
    <div className={`inline-flex gap-2 items-start ${compact ? "flex-row" : "flex-col items-center"} ${className}`}>
      <button
        type="button"
        onClick={() => toggle()}
        disabled={phase === "resolving"}
        className={`${btnPad} rounded-lg border transition-colors shrink-0 ${
          phase === "listening"
            ? "border-red-300 bg-red-50 text-red-700 animate-pulse"
            : phase === "resolving"
              ? "border-blue-200 bg-blue-50 text-blue-700 cursor-wait opacity-90"
              : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700"
        }`}
        aria-label={showStop ? "Stop listening" : label}
        title={compact ? title : hint || label}
      >
        {phase === "resolving" ? <Loader2 className={`${iconCls} animate-spin`} /> : showStop ? <Square className={iconCls} /> : <Mic className={iconCls} />}
      </button>
      {!compact && hint ? <span className="text-xs text-amber-700 max-w-[220px] leading-snug">{hint}</span> : null}
      {!compact && phase === "listening" ? <span className="text-xs text-gray-500">Listening… speak now.</span> : null}
      {!compact && phase === "resolving" ? <span className="text-xs text-gray-500">Finding medicine…</span> : null}
    </div>
  );
}
