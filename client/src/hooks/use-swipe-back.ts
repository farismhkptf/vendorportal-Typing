import { useEffect, useRef } from "react";

interface SwipeBackOptions {
  threshold?: number;
  edgeWidth?: number;
  onSwipeBack?: () => void;
}

export function useSwipeBack(options: SwipeBackOptions = {}) {
  const { threshold = 80, edgeWidth = 40, onSwipeBack } = options;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

    function isInteractiveTarget(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.closest("[data-radix-scroll-area-viewport]")) return true;
      if (el.closest(".embla")) return true;
      const style = window.getComputedStyle(el);
      if (style.overflowX === "auto" || style.overflowX === "scroll") {
        if (el.scrollWidth > el.clientWidth) return true;
      }
      return false;
    }

    function handleTouchStart(e: TouchEvent) {
      if (!isMobile()) return;
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      if (touch.clientX > edgeWidth) return;
      if (isInteractiveTarget(e.target)) return;

      const sidebar = document.querySelector("[data-testid='sidebar']");
      if (sidebar) return;

      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      swiping.current = true;
      cancelled.current = false;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!swiping.current || cancelled.current) return;
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      const deltaX = touch.clientX - touchStartX.current;

      if (deltaY > 30 && deltaY > Math.abs(deltaX) * 0.6) {
        cancelled.current = true;
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!swiping.current || cancelled.current) {
        swiping.current = false;
        return;
      }
      swiping.current = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      if (deltaX > threshold && deltaY < deltaX * 0.5) {
        if (onSwipeBack) {
          onSwipeBack();
        } else if (window.history.length > 1) {
          window.history.back();
        }
      }
    }

    function handleTouchCancel() {
      swiping.current = false;
      cancelled.current = false;
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [threshold, edgeWidth, onSwipeBack]);
}
