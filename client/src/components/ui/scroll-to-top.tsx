import { useEffect } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const scrollable = document.querySelector<HTMLElement>("[data-scroll-container]");
    if (scrollable) {
      scrollable.scrollTop = 0;
    }
  }, [location]);

  return null;
}
