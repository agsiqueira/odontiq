"use client";

import Image from "next/image";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { Button } from "@/components/ui/button";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Point = {
  x: number;
  y: number;
};

type ZoomableExaminationImageProps = {
  src: string;
  alt: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function ZoomableExaminationImage({
  src,
  alt,
}: ZoomableExaminationImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<
    | { pointerId: number; start: Point; startingPan: Point }
    | undefined
  >(undefined);
  const pinchRef = useRef<
    | { startingDistance: number; startingZoom: number }
    | undefined
  >(undefined);
  const zoomRef = useRef(MIN_ZOOM);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const boundPan = useCallback((nextPan: Point, atZoom: number): Point => {
    if (atZoom <= MIN_ZOOM) {
      return { x: 0, y: 0 };
    }

    const image = imageRef.current;
    if (!image) {
      return nextPan;
    }

    const maximumX = (image.offsetWidth * (atZoom - MIN_ZOOM)) / 2;
    const maximumY = (image.offsetHeight * (atZoom - MIN_ZOOM)) / 2;

    return {
      x: clamp(nextPan.x, -maximumX, maximumX),
      y: clamp(nextPan.y, -maximumY, maximumY),
    };
  }, []);

  const updateZoom = useCallback(
    (nextZoom: number) => {
      const boundedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = boundedZoom;
      setZoom(boundedZoom);
      setPan((currentPan) => boundPan(currentPan, boundedZoom));
      if (boundedZoom === MIN_ZOOM) {
        setIsDragging(false);
        dragRef.current = undefined;
      }
    },
    [boundPan],
  );

  const reset = useCallback(() => {
    pointersRef.current.clear();
    dragRef.current = undefined;
    pinchRef.current = undefined;
    zoomRef.current = MIN_ZOOM;
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateZoom(
        zoomRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
      );
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [updateZoom]);

  useEffect(() => {
    const handleResize = () => {
      setPan((currentPan) => boundPan(currentPan, zoomRef.current));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [boundPan]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = [...pointersRef.current.values()];
    if (pointers.length === 2) {
      pinchRef.current = {
        startingDistance: distance(pointers[0], pointers[1]),
        startingZoom: zoomRef.current,
      };
      dragRef.current = undefined;
      setIsDragging(false);
    } else if (zoomRef.current > MIN_ZOOM) {
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        startingPan: pan,
      };
      setIsDragging(true);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const pointers = [...pointersRef.current.values()];

    if (pointers.length === 2 && pinchRef.current) {
      const nextZoom =
        pinchRef.current.startingZoom *
        (distance(pointers[0], pointers[1]) /
          pinchRef.current.startingDistance);
      updateZoom(nextZoom);
      return;
    }

    const drag = dragRef.current;
    if (
      pointers.length === 1 &&
      drag?.pointerId === event.pointerId &&
      zoomRef.current > MIN_ZOOM
    ) {
      setPan(
        boundPan(
          {
            x: drag.startingPan.x + event.clientX - drag.start.x,
            y: drag.startingPan.y + event.clientY - drag.start.y,
          },
          zoomRef.current,
        ),
      );
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    dragRef.current = undefined;
    pinchRef.current = undefined;
    setIsDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateZoom(zoomRef.current + ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      updateZoom(zoomRef.current - ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      reset();
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Zoomable examination image"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`relative flex size-full items-center justify-center overflow-hidden px-[5vw] pb-[5vh] pt-[calc(5rem+5vh)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
        zoom === MIN_ZOOM
          ? "cursor-zoom-in"
          : isDragging
            ? "cursor-grabbing"
            : "cursor-grab"
      }`}
      style={{ touchAction: "none" }}
    >
      <Image
        ref={imageRef}
        src={src}
        alt={alt}
        width={1600}
        height={1200}
        unoptimized
        draggable={false}
        onLoad={() => setPan((currentPan) => boundPan(currentPan, zoomRef.current))}
        className="block h-auto max-h-full w-auto max-w-full select-none object-contain"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-3 z-20 flex justify-center px-3"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-black/75 p-1 text-white shadow-lg backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            title="Zoom out (-)"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => updateZoom(zoomRef.current - ZOOM_STEP)}
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <Minus />
          </Button>
          <output
            aria-live="polite"
            aria-label={`Current zoom ${Math.round(zoom * 100)} percent`}
            className="min-w-14 text-center text-xs font-semibold tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            title="Zoom in (+)"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => updateZoom(zoomRef.current + ZOOM_STEP)}
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Reset image zoom"
            title="Reset zoom (0)"
            disabled={zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0}
            onClick={reset}
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
