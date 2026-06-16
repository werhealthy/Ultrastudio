import type { CampaignStep } from "@/lib/campaign-types";

type StepCardProps = {
  step: CampaignStep;
  isActive: boolean;
};

export function StepCard({ step, isActive }: StepCardProps) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 transition-all",
        isActive
          ? "border-tim-blue bg-white shadow-soft"
          : "border-white/40 bg-white/55 hover:bg-white/75",
      ].join(" ")}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-tim-soft px-3 py-1 text-xs font-black text-tim-blue">
          {step.eyebrow}
        </span>
        <span className={isActive ? "h-3 w-3 rounded-full bg-tim-red" : "h-3 w-3 rounded-full bg-black/15"} />
      </div>
      <h3 className="mb-2 text-lg font-black tracking-tight text-black">{step.title}</h3>
      <p className="text-sm leading-5 text-black/55">{step.description}</p>
    </div>
  );
}
