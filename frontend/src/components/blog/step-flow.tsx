export interface Step {
  title: string;
  description: string;
}

export function StepFlow({ steps }: { steps: Step[] }) {
  return (
    <ol className="not-prose my-8 space-y-0">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {i < steps.length - 1 && <span className="w-px flex-1 bg-border my-1" aria-hidden="true" />}
          </div>
          <div className={i < steps.length - 1 ? 'pb-6' : ''}>
            <p className="font-bold text-foreground leading-snug">{step.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
