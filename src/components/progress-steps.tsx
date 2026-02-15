interface ProgressStepsProps {
  steps: string[];
  current: number;
}

export function ProgressSteps({ steps, current }: ProgressStepsProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < current
                  ? "bg-success text-white"
                  : i === current
                  ? "bg-navy text-white"
                  : "bg-slate/15 text-slate"
              }`}
            >
              {i < current ? "\u2713" : i + 1}
            </div>
            <span
              className={`text-sm ${
                i === current ? "font-medium text-navy" : "text-slate"
              }`}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-px ${i < current ? "bg-success" : "bg-slate/20"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
