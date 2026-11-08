import { Check } from "lucide-react";
import clsx from "clsx";

export interface WizardStepDef {
  id: number;
  title: string;
  subtitle: string;
}

interface WizardStepperProps {
  steps: WizardStepDef[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isDone = step.id < currentStep;
        const isActive = step.id === currentStep;
        const clickable = Boolean(onStepClick) && !isActive;

        return (
          <div key={step.id} className="flex flex-1 items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(step.id)}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg text-left",
                clickable && "cursor-pointer hover:bg-brand-50"
              )}
            >
              <div
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  isDone && "bg-emerald-500 text-white",
                  isActive && "bg-brand-500 text-white",
                  !isDone && !isActive && "bg-ink-100 text-ink-500",
                  clickable && !isDone && "ring-1 ring-brand-200"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <div className="hidden pr-2 sm:block">
                <div className={clsx("text-sm font-semibold", isActive ? "text-brand-600" : "text-ink-700")}>
                  {step.title}
                </div>
                <div className="text-[11px] text-ink-500">{step.subtitle}</div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div className={clsx("mx-3 h-0.5 flex-1", isDone ? "bg-emerald-400" : "bg-ink-100")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
