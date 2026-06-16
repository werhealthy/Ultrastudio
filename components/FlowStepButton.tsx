import type { StudioStep } from "@/lib/ultrastudio-data";

type FlowStepButtonProps = {
  step: StudioStep;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
};

export function FlowStepButton({ step, isActive, isCompleted, onClick }: FlowStepButtonProps) {
  const Icon = step.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group w-full rounded-3xl border p-4 text-left transition-all duration-200",
        isActive
          ? "border-white bg-white text-black shadow-[0_20px_60px_rgba(0,17,54,0.18)]"
          : "border-white/35 bg-white/48 text-black/70 hover:bg-white/70",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={[
              "flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-black",
              isActive ? "bg-tim-blue text-white" : "bg-white text-tim-blue",
            ].join(" ")}
          >
            {step.index}
          </span>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-tim-blue">{step.label}</span>
        </div>
        <Icon size={18} className={isActive ? "text-tim-red" : isCompleted ? "text-tim-blue" : "text-black/25"} />
      </div>
      <h3 className="text-base font-black tracking-[-0.03em] text-black">{step.title}</h3>
      <p className="mt-1 text-sm leading-5 text-black/55">{step.description}</p>
    </button>
  );
}
