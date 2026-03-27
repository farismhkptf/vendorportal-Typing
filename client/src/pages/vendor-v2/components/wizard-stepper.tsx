import { Eye, FileCheck, CheckCircle2, Check } from "lucide-react";
import type { WizardStep } from "./types";
import { getStepState } from "./types";

const STEPS = [
  { num: 1 as WizardStep, label: "Overview", icon: Eye },
  { num: 2 as WizardStep, label: "Documents", icon: FileCheck },
  { num: 3 as WizardStep, label: "Complete", icon: CheckCircle2 },
];

interface WizardStepperProps {
  viewStep: WizardStep;
  activeStep: WizardStep;
  status: string;
  onStepChange: (step: WizardStep) => void;
}

export function WizardStepper({ viewStep, activeStep, status, onStepChange }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-white/5" data-testid="v2-wizard-stepper">
      {STEPS.map((step) => {
        const state = getStepState(step.num, activeStep, status);
        const isViewing = viewStep === step.num;
        const canClick = state === "completed" || state === "active";
        const Icon = step.icon;
        return (
          <button
            key={step.num}
            onClick={() => canClick && onStepChange(step.num)}
            disabled={!canClick}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              isViewing
                ? state === "completed"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-white/15 text-slate-900 dark:text-white"
                : canClick
                  ? "text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                  : "text-slate-300 dark:text-white/20 cursor-not-allowed"
            }`}
            data-testid={`v2-step-${step.num}`}
          >
            {state === "completed" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
