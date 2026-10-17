"use client";

import {
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VoiceInputControl } from "@/components/VoiceInputControl";
import { cn } from "@/lib/utils";

type InteractionComposerProps = {
  value: string;
  placeholder: string;
  isSubmitting: boolean;
  isListening: boolean;
  isVoiceSupported: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onToggleVoiceInput: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  inputDataAttribute?: string;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  onSendPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  errorMessage?: string;
  statusMessage?: string;
  submitLabel?: string;
  voiceSize?: "large" | "compact" | "mentor";
  className?: string;
  formClassName?: string;
  inputClassName?: string;
  sendButtonClassName?: string;
};

export function InteractionComposer({
  value,
  placeholder,
  isSubmitting,
  isListening,
  isVoiceSupported,
  onChange,
  onSubmit,
  onToggleVoiceInput,
  leftAction,
  rightAction,
  inputRef,
  inputDataAttribute,
  onInputFocus,
  onInputBlur,
  onSendPointerDown,
  errorMessage,
  statusMessage,
  submitLabel = "Send message",
  voiceSize = "mentor",
  className,
  formClassName,
  inputClassName,
  sendButtonClassName,
}: InteractionComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={className}>
      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {!errorMessage && statusMessage ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm leading-5 text-[var(--color-text-secondary)]"
        >
          {statusMessage}
        </p>
      ) : null}

      <form className={cn("mt-2 grid gap-2", formClassName)} onSubmit={handleSubmit}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="justify-self-start">{leftAction}</div>
          <div className="justify-self-center">
            <VoiceInputControl
              size={voiceSize}
              isListening={isListening}
              isSupported={isVoiceSupported}
              isDisabled={isSubmitting}
              onToggle={onToggleVoiceInput}
            />
          </div>
          <div className="justify-self-end">{rightAction}</div>
        </div>
        <div className="grid grid-cols-[1fr_3rem] gap-2">
          <input
            ref={inputRef}
            type="text"
            data-encounter-keyboard-input={
              inputDataAttribute === "encounter-keyboard-input" ? true : undefined
            }
            className={cn(
              "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]",
              inputClassName,
            )}
            value={value}
            placeholder={placeholder}
            disabled={isSubmitting}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon-lg"
            className={cn(
              "min-h-11 rounded-xl bg-[var(--color-action)] text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]",
              sendButtonClassName,
            )}
            disabled={isSubmitting || value.trim().length === 0}
            aria-label={submitLabel}
            onPointerDown={onSendPointerDown}
          >
            <Send className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
