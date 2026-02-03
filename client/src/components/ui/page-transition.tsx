import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayChildren(children);
      return;
    }

    setTransitionStage("exit");
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage("enter");
    }, 150);

    return () => clearTimeout(timeout);
  }, [location, children, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <div
      className={`transition-opacity duration-150 ease-in-out ${
        transitionStage === "enter" ? "opacity-100" : "opacity-0"
      }`}
    >
      {displayChildren}
    </div>
  );
}
