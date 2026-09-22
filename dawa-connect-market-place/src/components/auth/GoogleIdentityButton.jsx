"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

export default function GoogleIdentityButton({ intent, onCredential, onError }) {
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [configuration, setConfiguration] = useState(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonceVersion, setNonceVersion] = useState(0);
  callbackRef.current = onCredential;

  useEffect(() => {
    const controller = new AbortController();
    setConfiguration(null);
    fetch("/api/auth/google/nonce", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Google sign-in is unavailable.");
        return data;
      })
      .then((data) => setConfiguration(data))
      .catch((error) => {
        if (!controller.signal.aborted) onError?.(error.message);
      });
    return () => controller.abort();
  }, [nonceVersion, onError]);

  const renderButton = useCallback(() => {
    if (!configuration?.clientId || !configuration?.nonce || !window.google?.accounts?.id || !buttonRef.current) return;
    const width = Math.max(240, Math.min(400, Math.floor(buttonRef.current.getBoundingClientRect().width || 400)));
    buttonRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: configuration.clientId,
      nonce: configuration.nonce,
      ux_mode: "popup",
      cancel_on_tap_outside: true,
      callback: async ({ credential }) => {
        if (!credential || busy) return;
        setBusy(true);
        try {
          const result = await callbackRef.current?.(credential);
          if (!result?.success) setNonceVersion((value) => value + 1);
        } finally {
          setBusy(false);
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
  }, [configuration, busy]);

  useEffect(() => {
    if (window.google?.accounts?.id) setScriptReady(true);
  }, []);

  useEffect(() => {
    if (!scriptReady || !configuration) return undefined;
    renderButton();
    const observer = new ResizeObserver(renderButton);
    if (buttonRef.current) observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, [scriptReady, configuration, renderButton]);

  return (
    <div
      className="relative min-h-11 w-full"
      aria-busy={busy}
      aria-label={intent === "signup" ? "Register with Google" : "Sign in with Google"}
    >
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onError?.("Google sign-in could not be loaded. Check your connection and try again.")}
      />
      <div ref={buttonRef} className={busy ? "pointer-events-none opacity-60" : ""} />
      {(!scriptReady || !configuration) && (
        <div className="flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
          Preparing Google sign-in…
        </div>
      )}
    </div>
  );
}
