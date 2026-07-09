"use client";

import { useEffect, useRef } from "react";

import type { ConversationMessage } from "@/lib/conversationEngine";

type EncounterConversationProps = {
  messages: ConversationMessage[];
  isOpen: boolean;
};

export function EncounterConversation({
  messages,
  isOpen,
}: EncounterConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, messages.length]);

  return (
    <div ref={scrollRef} className="conversation-scroll overflow-y-auto px-5 pt-4">
      <div className="space-y-4 pb-[calc(var(--encounter-controls-height,15.25rem)+1rem)]">
        {messages.map((message) => (
          <div key={message.id}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {message.role === "student" ? "Student" : "Patient"}
            </p>
            <p className="mt-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm leading-6">
              {message.text}
            </p>
          </div>
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
