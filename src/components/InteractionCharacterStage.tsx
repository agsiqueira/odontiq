"use client";

import Image from "next/image";
import { forwardRef, type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

type InteractionCharacterStageProps =
  | {
      mode: "media";
      idleSrc: string;
      talkingSrc: string;
      alt: string;
      isTalking: boolean;
      className?: string;
      fallback?: ReactNode;
      mediaClassName?: string;
    }
  | {
      mode: "custom";
      children: ReactNode;
      className?: string;
    };

export const InteractionCharacterStage = forwardRef<
  HTMLVideoElement,
  InteractionCharacterStageProps
>(function InteractionCharacterStage(props, ref) {
  const [idleImageFailed, setIdleImageFailed] = useState(false);

  return (
    <div
      data-interaction-character-stage
      className={cn(
        "relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[var(--elevation-subtle)]",
        props.mode === "media" ? "bg-black" : "bg-white",
        props.className,
      )}
    >
      {props.mode === "media" ? (
        <>
          <Image
            src={props.idleSrc}
            alt={props.alt}
            fill
            priority
            sizes="(max-width: 480px) 100vw, 480px"
            className={cn(
              "z-10 object-cover transition-opacity duration-200",
              props.mediaClassName,
              props.isTalking ? "opacity-0" : "opacity-100",
            )}
            onError={(event) => {
              setIdleImageFailed(true);
              event.currentTarget.style.opacity = "0";
            }}
          />
          <video
            ref={ref}
            src={props.talkingSrc}
            poster={props.idleSrc}
            aria-label={props.alt}
            loop
            muted
            playsInline
            preload="auto"
            className={cn(
              "absolute inset-0 z-20 size-full object-cover transition-opacity duration-200",
              props.mediaClassName,
              props.isTalking ? "opacity-100" : "opacity-0",
            )}
          />
          {idleImageFailed ? (
            <div
              className={cn(
                "absolute inset-0 z-0 transition-opacity duration-200",
                props.isTalking ? "opacity-0" : "opacity-100",
              )}
            >
              {props.fallback}
            </div>
          ) : null}
        </>
      ) : (
        props.children
      )}
    </div>
  );
});
