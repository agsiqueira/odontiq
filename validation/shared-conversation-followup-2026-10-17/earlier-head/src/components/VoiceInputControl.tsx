"use client";

import { Mic, Square } from "lucide-react";

import { cn } from "@/lib/utils";

type VoiceInputControlProps = {
  isListening: boolean;
  isSupported: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
  size?: "large" | "compact" | "mentor";
};

export function VoiceInputControl({
  isListening,
  isSupported,
  isDisabled = false,
  onToggle,
  size = "large",
}: VoiceInputControlProps) {
  const isLarge = size === "large";
  const isMentor = size === "mentor";

  if (isMentor) {
    return (
      <div className="relative grid min-h-[3.75rem] place-items-center">
        <button
          type="button"
          aria-label={isListening ? "Stop listening" : "Start voice input"}
          disabled={isDisabled || !isSupported}
          onClick={onToggle}
          className="inline-flex size-14 touch-manipulation items-center justify-center rounded-full bg-[var(--color-action)] text-white shadow-[0_8px_20px_rgba(63,166,107,0.18)] disabled:opacity-45"
        >
          {isListening ? (
            <Square className="size-6" />
          ) : (
            <Mic className="size-7" />
          )}
        </button>
        <p
          aria-live="polite"
          className="absolute left-[calc(50%+2.25rem)] top-1/2 w-24 -translate-y-1/2 text-left text-xs font-medium leading-5 text-[var(--color-brand)]"
        >
          {isListening ? "Listening..." : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid place-items-center",
        isLarge && "min-h-[7.25rem] grid-rows-[6rem_1.25rem]",
        !isLarge && "min-h-[4.75rem] grid-rows-[3rem_1.25rem]",
      )}
    >
      <button
        type="button"
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        disabled={isDisabled || !isSupported}
        onClick={onToggle}
        className={cn(
          "inline-flex touch-manipulation items-center justify-center rounded-full bg-[var(--color-action)] text-white disabled:opacity-45",
          isLarge && "size-24 shadow-[0_10px_24px_rgba(63,166,107,0.22)]",
          !isLarge && "size-12 shadow-[0_8px_20px_rgba(63,166,107,0.18)]",
        )}
      >
        {isListening ? (
          <Square className={isLarge ? "size-9" : "size-5"} />
        ) : (
          <Mic className={isLarge ? "size-10" : "size-5"} />
        )}
      </button>
      <p
        aria-live="polite"
        className={cn(
          "font-medium text-[var(--color-brand)]",
          isLarge && "text-sm",
          !isLarge && "text-[0.7rem] leading-5",
        )}
      >
        {isListening ? "Listening..." : ""}
      </p>
    </div>
  );
}
