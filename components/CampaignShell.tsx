import { ArrowRight, Check, ImagePlus, Sparkles, UploadCloud } from "lucide-react";
import { campaignSteps, defaultCharacterConfig } from "@/lib/constants";
import { StepCard } from "./StepCard";

export function CampaignShell() {
  return (
    <main className="min-h-screen px-6 py-8 lg:px-10 lg:py-10">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-5xl border border-white/35 bg-white/35 p-5 backdrop-blur-2xl">
          <div className="mb-8 rounded-4xl bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-tim-blue">TIMMY</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-black">
              Campaign Adaptation Tool
            </h1>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Un workspace unico per adattare visual TIM, approvare un soggetto e generare copy coerenti.
            </p>
          </div>

          <div className="grid gap-3">
            {campaignSteps.map((step, index) => (
              <StepCard key={step.id} step={step} isActive={index === 1} />
            ))}
          </div>
        </aside>

        <section className="rounded-5xl bg-white p-6 shadow-soft lg:p-8">
          <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-tim-blue">Step 02</p>
              <h2 className="max-w-3xl text-5xl font-black tracking-[-0.07em] text-black lg:text-6xl">
                Crea il soggetto della campagna
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-black/55">
                Carica il key visual, imposta i parametri del soggetto e genera varianti mantenendo layout, branding e prodotto.
              </p>
            </div>

            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-tim-blue px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-tim-deep">
              Genera varianti <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="rounded-4xl border border-black/10 bg-tim-soft p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-black">Key visual</h3>
                  <p className="text-sm text-black/50">Upload dell’asset principale della campagna.</p>
                </div>
                <ImagePlus className="text-tim-blue" />
              </div>

              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-4xl border border-dashed border-tim-blue/35 bg-white text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-tim-soft text-tim-blue">
                  <UploadCloud size={30} />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-black">Carica asset</h4>
                <p className="mt-2 max-w-sm text-sm leading-6 text-black/50">
                  PNG, JPG o WEBP. In questa prima schermata è solo UI: collegheremo upload e API nello step successivo.
                </p>
                <button className="mt-6 rounded-full border border-tim-blue px-5 py-3 text-sm font-black uppercase tracking-wide text-tim-blue transition hover:bg-tim-blue hover:text-white">
                  Seleziona file
                </button>
              </div>
            </div>

            <div className="rounded-4xl border border-black/10 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-black">Character controls</h3>
                  <p className="text-sm text-black/50">Parametri che alimentano il prompt.</p>
                </div>
                <Sparkles className="text-tim-red" />
              </div>

              <div className="grid gap-4">
                {Object.entries(defaultCharacterConfig).map(([key, value]) => (
                  <label key={key} className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-black/45">
                      {key}
                    </span>
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-tim-soft px-4 py-3">
                      <span className="text-sm font-bold text-black">{value}</span>
                      <Check size={16} className="text-tim-blue" />
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 rounded-3xl bg-black p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Prompt logic</p>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  Mantieni visual, prodotto e branding. Sostituisci solo il soggetto secondo i parametri selezionati.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
