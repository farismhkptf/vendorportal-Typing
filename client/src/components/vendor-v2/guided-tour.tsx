import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, HelpCircle } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='greeting']",
    title: "Welcome to Your Portal",
    description: "This is your personalized dashboard. It shows a quick summary of your day — pending jobs, alerts, and your current workload at a glance.",
    position: "bottom",
  },
  {
    target: "[data-tour='metrics']",
    title: "Key Metrics",
    description: "Track your wallet balance, active jobs, completion rate, and average turnaround time. Tap any card to dive deeper.",
    position: "bottom",
  },
  {
    target: "[data-tour='pipeline']",
    title: "Job Pipeline",
    description: "This bar shows the distribution of your jobs — pending (amber), active (blue), and completed (green). A quick visual of your workflow.",
    position: "bottom",
  },
  {
    target: "[data-tour='quicklinks']",
    title: "Quick Access",
    description: "Jump directly to Emirates ID jobs, Medical jobs, or your Wallet from these shortcuts.",
    position: "bottom",
  },
  {
    target: "[data-tour='notifications']",
    title: "Notifications",
    description: "Stay updated with real-time alerts for new jobs, wallet top-ups, and status changes. The red badge shows unread count.",
    position: "bottom",
  },
  {
    target: "[data-tour='profile']",
    title: "Your Profile",
    description: "Access your account settings, switch to the classic portal, or sign out from here.",
    position: "bottom",
  },
  {
    target: "[data-tour='bottom-nav']",
    title: "Navigation",
    description: "Use the bottom bar to switch between Home, EID jobs, Medical jobs, and your Wallet. Active badges show pending items.",
    position: "top",
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function GuidedTour({ isOpen, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastScrolledStep = useRef(-1);

  const refreshRect = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  const scrollAndHighlight = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      if (lastScrolledStep.current !== currentStep) {
        lastScrolledStep.current = currentStep;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 350);
      } else {
        setTargetRect(el.getBoundingClientRect());
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      lastScrolledStep.current = -1;
      setIsVisible(false);
      setTimeout(() => {
        setIsVisible(true);
      }, 100);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isVisible) {
      setIsAnimating(true);
      scrollAndHighlight();
      const timer = setTimeout(() => setIsAnimating(false), 400);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isOpen, isVisible, scrollAndHighlight]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => refreshRect();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, refreshRect]);

  if (!isOpen || !isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;
  const padding = 8;

  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    const tooltipMargin = 16;
    const maxTop = window.innerHeight - 200;

    const clampLeft = (idealLeft: number) =>
      Math.max(16, Math.min(idealLeft, window.innerWidth - tooltipWidth - 16));

    const clampTop = (idealTop: number) =>
      Math.max(16, Math.min(idealTop, maxTop));

    switch (step.position) {
      case "top":
        return {
          bottom: Math.max(16, window.innerHeight - targetRect.top + tooltipMargin),
          left: clampLeft(targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
          width: tooltipWidth,
        };
      case "bottom":
        return {
          top: clampTop(targetRect.bottom + tooltipMargin),
          left: clampLeft(targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
          width: tooltipWidth,
        };
      case "left":
        return {
          top: clampTop(targetRect.top + targetRect.height / 2 - 80),
          right: Math.max(16, window.innerWidth - targetRect.left + tooltipMargin),
          width: tooltipWidth,
        };
      case "right":
        return {
          top: clampTop(targetRect.top + targetRect.height / 2 - 80),
          left: clampLeft(targetRect.right + tooltipMargin),
          width: tooltipWidth,
        };
      default:
        return {};
    }
  };

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" data-testid="guided-tour-overlay">
      <div className="tour-overlay-backdrop" onClick={onComplete} />

      {spotlightStyle && (
        <div
          className="tour-spotlight"
          style={spotlightStyle}
        />
      )}

      <div
        ref={tooltipRef}
        className={`tour-tooltip ${isAnimating ? "tour-tooltip-entering" : ""}`}
        style={{ position: "fixed", ...getTooltipStyle() }}
        data-testid="tour-tooltip"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-500/30 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            </div>
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            onClick={onComplete}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            data-testid="button-tour-skip"
          >
            <X className="h-4 w-4 text-white/40" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-white mb-1.5">{step.title}</h3>
        <p className="text-sm text-white/60 leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-indigo-400"
                    : i < currentStep
                    ? "w-1.5 bg-white/30"
                    : "w-1.5 bg-white/10"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white/60 hover:text-white/80 hover:bg-white/5 transition-all"
                data-testid="button-tour-back"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-medium text-white glass-btn-primary"
              data-testid="button-tour-next"
            >
              {isLast ? "Got it!" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
      data-testid="button-tour-help"
      title="Take a tour"
    >
      <HelpCircle className="h-4.5 w-4.5 text-white/70" />
    </button>
  );
}
