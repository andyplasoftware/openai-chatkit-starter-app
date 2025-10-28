"use client";

import type { ReactNode } from "react";

type ErrorOverlayProps = {
  error: string | null;
  fallbackMessage?: ReactNode;
  onRetry?: (() => void) | null;
  retryLabel?: string;
};

export function ErrorOverlay({
  error,
  fallbackMessage,
  onRetry,
  retryLabel,
}: ErrorOverlayProps) {
  if (!error && !fallbackMessage) {
    return null;
  }

  const content = error ?? fallbackMessage;
  const isLoading = !error && fallbackMessage;

  if (!content) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex h-full w-full flex-col justify-center rounded-[inherit] bg-white/85 p-6 text-center backdrop-blur">
      <div className="pointer-events-auto mx-auto w-full max-w-md rounded-xl bg-white px-6 py-4 text-lg font-medium text-slate-700">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="relative">
            <div 
              className="h-10 w-10 animate-spin rounded-full border-3 border-[#740066]/20 border-t-[#740066]"
              style={{ animationDuration: "400ms" }}
            ></div>
            </div>
            <div className="text-base text-gray-900">{content}</div>
          </div>
        ) : (
          <div>{content}</div>
        )}
        {error && onRetry ? (
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: '#740066' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a004d')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#740066')}
            onClick={onRetry}
          >
            {retryLabel ?? "Restart chat"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
