"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type InteractionMessage = {
  id: string;
  role: string;
  text: string;
};

type InteractionConversationProps = {
  messages: InteractionMessage[];
  isActive?: boolean;
  roleLabels: Record<string, string>;
  className?: string;
  contentClassName?: string;
  bottomPaddingClassName?: string;
  compactFirstMessage?: boolean;
  hideRoleLabelsFor?: string[];
  renderAfterMessage?: (message: InteractionMessage, index: number) => ReactNode;
};

export function InteractionConversation({
  messages,
  isActive = true,
  roleLabels,
  className,
  contentClassName,
  bottomPaddingClassName = "pb-[calc(var(--encounter-controls-height,15.25rem)+1rem)]",
  compactFirstMessage = false,
  hideRoleLabelsFor = [],
  renderAfterMessage,
}: InteractionConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        block: "end",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isActive, messages.length]);

  return (
    <div className={cn("conversation-scroll overflow-y-auto px-5 pt-4", className)}>
      <div className={cn("space-y-4", bottomPaddingClassName, contentClassName)}>
        {messages.map((message, index) => (
          <div key={message.id}>
            <InteractionMessageBubble
              label={roleLabels[message.role] ?? message.role}
              message={message}
              compact={compactFirstMessage && index === 0}
              hideLabel={hideRoleLabelsFor.includes(message.role)}
            />
            {renderAfterMessage?.(message, index)}
          </div>
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}

function InteractionMessageBubble({
  compact,
  hideLabel,
  label,
  message,
}: {
  compact: boolean;
  hideLabel: boolean;
  label: string;
  message: InteractionMessage;
}) {
  const isStudent = message.role === "student";

  return (
    <div className={cn(isStudent && "ml-auto max-w-[92%]")}>
      {hideLabel ? null : (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]",
            isStudent && "text-right",
          )}
        >
          {label}
        </p>
      )}
      <p
        className={cn(
          "mt-1 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm leading-6",
          hideLabel && "mt-0",
          compact && "py-2.5",
          isStudent
            ? "rounded-tr-md bg-[var(--color-action)] text-white"
            : "rounded-tl-md bg-[var(--color-background)] text-[var(--color-text-primary)]",
        )}
      >
        {message.text}
      </p>
    </div>
  );
}
