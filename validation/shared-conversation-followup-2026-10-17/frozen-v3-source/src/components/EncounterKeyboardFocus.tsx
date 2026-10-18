"use client";

import { useEffect } from "react";

export function EncounterKeyboardFocus() {
  useEffect(() => {
    let animationFrame = 0;

    const syncMeasurements = () => {
      const root = document.documentElement;
      const visualViewport = window.visualViewport;
      const visualTop = visualViewport?.offsetTop ?? 0;
      const visualHeight = visualViewport?.height ?? window.innerHeight;
      const patientViewport = document.querySelector<HTMLElement>(
        "[data-encounter-patient-viewport]",
      );
      const controls = document.querySelector<HTMLElement>(".encounter-controls");

      root.style.setProperty("--encounter-visual-height", `${visualHeight}px`);
      root.style.setProperty("--encounter-vh", `${visualHeight}px`);
      root.style.setProperty("--vv-top", `${visualTop}px`);
      root.style.setProperty("--vv-height", `${visualHeight}px`);

      if (patientViewport) {
        const patientRect = patientViewport.getBoundingClientRect();
        root.style.setProperty(
          "--encounter-patient-bottom",
          `${patientRect.bottom}px`,
        );
      }

      if (controls) {
        root.style.setProperty(
          "--encounter-controls-height",
          `${controls.offsetHeight}px`,
        );
      }
    };

    const scheduleSyncMeasurements = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        syncMeasurements();
      });
    };

    const handleHashChange = () => {
      scheduleSyncMeasurements();

      if (window.location.hash === "#conversation") {
        scheduleSyncMeasurements();
      }
    };

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const conversationTrigger = target.closest('a[href="#conversation"]');
      const typingModeTrigger = target.closest('a[href="#keyboard-panel"]');
      const voiceModeTrigger = target.closest('a[href="#controls"]');

      if (conversationTrigger || typingModeTrigger || voiceModeTrigger) {
        scheduleSyncMeasurements();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.matches("[data-encounter-keyboard-input]")
      ) {
        scheduleSyncMeasurements();
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.matches("[data-encounter-keyboard-input]")
      ) {
        scheduleSyncMeasurements();
      }
    };

    const lockMobilePageScroll = () => {
      const shouldLock = window.matchMedia("(max-width: 640px)").matches;

      document.documentElement.style.overflow = shouldLock ? "hidden" : "";
      document.body.style.overflow = shouldLock ? "hidden" : "";
      document.body.style.overscrollBehavior = shouldLock ? "none" : "";
    };

    syncMeasurements();
    handleHashChange();
    lockMobilePageScroll();

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("resize", scheduleSyncMeasurements);
    window.addEventListener("resize", lockMobilePageScroll);
    window.visualViewport?.addEventListener("resize", scheduleSyncMeasurements);
    window.visualViewport?.addEventListener("scroll", scheduleSyncMeasurements);
    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("resize", scheduleSyncMeasurements);
      window.removeEventListener("resize", lockMobilePageScroll);
      window.visualViewport?.removeEventListener(
        "resize",
        scheduleSyncMeasurements,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        scheduleSyncMeasurements,
      );
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  return null;
}
