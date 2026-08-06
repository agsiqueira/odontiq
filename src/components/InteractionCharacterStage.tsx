"use client";

import Image from "next/image";
import { forwardRef, type ReactNode, useEffect, useRef, useState } from "react";

import { startAmaraBreathingAnimation } from "@/lib/amaraBreathingAnimation";
import { cn } from "@/lib/utils";

type InteractionCharacterStageProps =
  | {
      mode: "media";
      idleSrc: string;
      talkingSrc: string;
      alt: string;
      isTalking: boolean;
      breathingSrc?: string;
      isBreathing?: boolean;
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
  const [breathingVideoFailed, setBreathingVideoFailed] = useState(false);
  const breathingVideoRef = useRef<HTMLVideoElement>(null);
  const isBreathing = props.mode === "media" && Boolean(props.isBreathing);
  const isBreathingVideoVisible =
    isBreathing && !breathingVideoFailed;

  useEffect(() => {
    if (!isBreathing || breathingVideoFailed) return;
    return startAmaraBreathingAnimation(breathingVideoRef.current);
  }, [breathingVideoFailed, isBreathing]);

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
              props.isTalking || isBreathingVideoVisible ? "opacity-0" : "opacity-100",
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
              props.isTalking && !isBreathingVideoVisible ? "opacity-100" : "opacity-0",
            )}
          />
          {props.breathingSrc ? (
            <video
              ref={breathingVideoRef}
              src={props.breathingSrc}
              poster={props.idleSrc}
              aria-label={`${props.alt} breathing`}
              muted
              playsInline
              preload="metadata"
              className={cn(
                "absolute inset-0 z-30 size-full object-cover transition-opacity duration-200",
                props.mediaClassName,
                isBreathingVideoVisible ? "opacity-100" : "opacity-0",
              )}
              onError={() => setBreathingVideoFailed(true)}
            />
          ) : null}
          {idleImageFailed ? (
            <div
              className={cn(
                "absolute inset-0 z-0 transition-opacity duration-200",
                props.isTalking || isBreathingVideoVisible ? "opacity-0" : "opacity-100",
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
