"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Flow = "campaign" | "visual" | "copy" | null;
type CampaignStep = "asset" | "subject" | "visual" | "copy" | "final";
type CopyStage = "choice" | "mood" | "proposals" | "manual" | "price" | "summary";

// Stato della generazione in background
type GenStatus = "idle" | "running" | "done" | "error";

const CHAR_LIMITS = { hero: 26, cta: 32, legal: 220, mood: 300 } as const;

const icons = {
  home: "/icons/home.png", star: "/icons/star.png", profile: "/icons/profile.png",
  document: "/icons/document.png", upload: "/icons/upload.png", eye: "/icons/eye.png",
  download: "/icons/upload.png", figma: "/icons/figma-icon.png",
  group: "/icons/group.png", check: "/icons/check.png",
};

const demoVariants = ["/demo/demo-variant-01.png","/demo/demo-variant-02.png","/demo/demo-variant-03.png"];
const finalCampaign = "/demo/demo-final-campaign.png";
const fallbackHeroOptions = ["Qui navigo alla grande","Qui resto sempre online","Qui il segnale è top"];
const fallbackCtaOptions  = ["Scegli TIM WiFi CASA","Scopri l'offerta","Attiva ora"];

const campaignSteps = [
  { id:"asset",   label:"Asset" },
  { id:"subject", label:"Soggetto" },
  { id:"visual",  label:"Visual" },
  { id:"copy",    label:"Copy" },
  { id:"final",   label:"Finale" },
] as const;

function Icon({ src, className="" }: { src?: string; className?: string }) {
  if (!src) return null;
  return <img className={className} src={src} alt="" />;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function formatPriceRight(value: string) {
  const raw = String(value||"").trim();
  if (!raw) return "";
  const clean = raw.replace(/^,/,"").replace(/€$/,"").trim();
  return `,${clean} €`;
}

function priceForSummary(left: string, right: string, period: string) {
  return `${left}${formatPriceRight(right)} / ${period}`;
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return <span className={`char-count ${len > max ? "over" : ""}`}>{len}/{max}</span>;
}

// ── Banner generazione in background ──────────────────────────────────────────
function GenBanner({ status, progress }: { status: GenStatus; progress: number }) {
  if (status === "idle") return null;
  return (
    <div className={`gen-banner ${status}`}>
      <div className="gen-banner-left">
        {status === "running" && <span className="gen-spinner" />}
        {status === "done"    && <span className="gen-check">✓</span>}
        {status === "error"   && <span className="gen-err">✕</span>}
        <span className="gen-label">
          {status === "running" ? `Generazione visual in corso…` : ""}
          {status === "done"    ? "Visual generati — scegli dopo il copy" : ""}
          {status === "error"   ? "Errore nella generazione visual" : ""}
        </span>
      </div>
      {status === "running" && (
        <div className="gen-progress-wrap">
          <div className="gen-progress-bar" style={{ width: `${progress}%` }} />
          <span className="gen-progress-pct">{progress}%</span>
        </div>
      )}
    </div>
  );
}

export default function UltraStudioApp() {
  const [flow, setFlow]               = useState<Flow>(null);
  const [mode, setMode]               = useState<"demo"|"api">("demo");
  const [campaignStep, setCampaignStep] = useState<CampaignStep>("asset");
  const [copyStage, setCopyStage]     = useState<CopyStage>("choice");
  const [copyMode, setCopyMode]       = useState<"generated"|"manual"|null>(null);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [loadingMerge, setLoadingMerge] = useState(false);
  const [handoff, setHandoff]         = useState(false);

  // Generazione visual — IN BACKGROUND
  const [genStatus, setGenStatus]     = useState<GenStatus>("idle");
  const [genProgress, setGenProgress] = useState(0);
  const [apiPersonVariants, setApiPersonVariants] = useState<string[]>([]);
  const [apiSubjectVariants, setApiSubjectVariants] = useState<string[]>([]);
  const genTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const [uploadedAsset, setUploadedAsset] = useState<string|null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [approvedSubject, setApprovedSubject] = useState<string|null>(null);
  const [finalPreview, setFinalPreview] = useState<string|null>(null);

  const [format, setFormat]       = useState("Verticale");
  const [person, setPerson]       = useState("Donna");
  const [age, setAge]             = useState("23-28");
  const [face, setFace]           = useState("Mediterraneo");
  const [hair, setHair]           = useState("Medi");
  const [hairColor, setHairColor] = useState("Castano");
  const [expression, setExpression] = useState("Naturale");
  const [outfit, setOutfit]       = useState("Urban Casual");
  const [topColor, setTopColor]   = useState("#0033A1");
  const [target, setTarget]       = useState("Young Adult");
  const [visualMood, setVisualMood] = useState("Quotidiano");
  const [smartphone, setSmartphone] = useState("Mantieni orientamento originale");

  const [mood, setMood]           = useState("");
  const [hero, setHero]           = useState("");
  const [cta, setCta]             = useState("");
  const [heroOptions, setHeroOptions] = useState<string[]>(fallbackHeroOptions);
  const [ctaOptions, setCtaOptions]   = useState<string[]>(fallbackCtaOptions);
  const [priceLeft, setPriceLeft]   = useState("");
  const [priceRight, setPriceRight] = useState("");
  const [pricePeriod, setPricePeriod] = useState("");
  const [legalNotes, setLegalNotes] = useState("");

  const visualVariants = mode === "api" && apiSubjectVariants.length ? apiSubjectVariants : demoVariants;

  // ── Avvia progress bar per generazione background ─────────────────────────
  function startGenProgress() {
    setGenProgress(4);
    const start = Date.now();
    const dur = 210_000; // ~3.5 min per 3 varianti in sequenza
    if (genTimerRef.current) clearInterval(genTimerRef.current);
    genTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - ratio, 2.2);
      const next = Math.min(98, Math.round(4 + eased * 94));
      setGenProgress(next);
    }, 500);
  }

  function stopGenProgress() {
    if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
    setGenProgress(100);
  }

  useEffect(() => () => { if (genTimerRef.current) clearInterval(genTimerRef.current); }, []);

  function resetAll() {
    setFlow(null); setCampaignStep("asset"); setCopyStage("choice"); setCopyMode(null);
    setLoadingCopy(false); setLoadingMerge(false); setHandoff(false);
    setGenStatus("idle"); setGenProgress(0);
    if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
    setUploadedAsset(null); setSelectedVariant(0);
    setApiPersonVariants([]); setApiSubjectVariants([]);
    setApprovedSubject(null); setFinalPreview(null);
    setMood(""); setHero(""); setCta("");
    setHeroOptions(fallbackHeroOptions); setCtaOptions(fallbackCtaOptions);
    setPriceLeft(""); setPriceRight(""); setPricePeriod(""); setLegalNotes("");
  }

  // ── Compositing helper ────────────────────────────────────────────────────
  async function composeCampaignPreview(args: {
    subjectImageUrl: string; headlineValue: string; priceLeftValue: string;
    priceRightValue: string; pricePeriodValue: string; ctaValue: string;
    legalValue: string; outputName: string;
  }) {
    const res = await fetch("/api/compose-campaign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectImageUrl: args.subjectImageUrl, headline: args.headlineValue,
        priceLeft: args.priceLeftValue, priceRight: args.priceRightValue,
        pricePeriod: args.pricePeriodValue, cta: args.ctaValue,
        legalNotes: args.legalValue, legalNotice: args.legalValue,
        outputName: args.outputName,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Compositing non riuscito.");
    return String(data?.imageUrl || "");
  }

  // ── Generazione soggetto IN BACKGROUND ────────────────────────────────────
  // Viene chiamata quando l'utente clicca "Genera soggetto" nello step Soggetto.
  // NON blocca il flusso — l'utente procede subito allo step Copy.
  const generateSubjectBackground = useCallback(async () => {
    if (mode !== "api") return;
    setGenStatus("running");
    startGenProgress();

    try {
      const assetResp = await fetch("/templates/template-01-preview.png");
      if (!assetResp.ok) throw new Error("Template non trovato.");
      const blob = await assetResp.blob();
      const fd = new FormData();
      fd.append("asset", blob, "template-01-preview.png");
      fd.append("format", format); fd.append("person", person); fd.append("age", age);
      fd.append("face", face); fd.append("hair", hair); fd.append("hairColor", hairColor);
      fd.append("expression", expression); fd.append("outfit", outfit);
      fd.append("topColor", topColor); fd.append("target", target);
      fd.append("mood", visualMood); fd.append("smartphone", smartphone);

      const res  = await fetch("/api/generate-visual", { method:"POST", body:fd });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Risposta non valida: ${text.slice(0,120)}`); }
      if (!res.ok) throw new Error(data?.error || "Generazione non riuscita.");

      const personUrls: string[] = Array.isArray(data.personVariants) ? data.personVariants : (data.variants || []);
      if (!personUrls.length) throw new Error("Nessuna variante ricevuta.");

      // Composita preview con placeholder copy
      const previewUrls: string[] = [];
      for (let i = 0; i < personUrls.length; i++) {
        const url = await composeCampaignPreview({
          subjectImageUrl: personUrls[i],
          headlineValue: "Lorem ipsum dolor sit amet",
          priceLeftValue: "XX", priceRightValue: "XX",
          pricePeriodValue: "Lorem ipsum dolor sit amet lorecul amet",
          ctaValue: "Lorem ipsum dolor sit",
          legalValue: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
          outputName: `generated-preview-${Date.now()}-${i+1}.png`,
        });
        previewUrls.push(url);
      }

      setApiPersonVariants(personUrls);
      setApiSubjectVariants(previewUrls.length ? previewUrls : personUrls);
      setApprovedSubject(personUrls[0]);
      setSelectedVariant(0);
      stopGenProgress();
      setGenStatus("done");
    } catch (err) {
      stopGenProgress();
      setGenStatus("error");
      console.error("[UltraStudio] generateSubjectBackground error:", err);
    }
  }, [mode, format, person, age, face, hair, hairColor, expression, outfit, topColor, target, visualMood, smartphone]);

  async function generateProposals() {
    if (!mood.trim()) return;
    setCopyMode("generated");

    if (mode === "demo") {
      setLoadingCopy(true);
      await new Promise(r => setTimeout(r, 2200));
      setHeroOptions(fallbackHeroOptions); setCtaOptions(fallbackCtaOptions);
      setHero(""); setCta("");
      setLoadingCopy(false);
      setCopyStage("proposals");
      return;
    }

    try {
      setLoadingCopy(true);
      const res  = await fetch("/api/generate-copy", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ mood }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Risposta non valida: ${text.slice(0,120)}`); }
      if (!res.ok) throw new Error(data?.error || "Generazione copy non riuscita.");
      const rawH: string[] = Array.isArray(data.heroOptions) ? data.heroOptions.slice(0,3) : fallbackHeroOptions;
      const rawC: string[] = Array.isArray(data.ctaOptions)  ? data.ctaOptions.slice(0,3)  : fallbackCtaOptions;
      setHeroOptions(rawH.map(h=>h.slice(0,CHAR_LIMITS.hero)));
      setCtaOptions(rawC.map(c=>c.slice(0,CHAR_LIMITS.cta)));
      setHero(""); setCta(""); setCopyStage("proposals");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Errore generazione copy.");
    } finally {
      setLoadingCopy(false);
    }
  }

  function canContinueFromPrice() {
    return Boolean(hero.trim() && cta.trim() && priceLeft.trim() && priceRight.trim() && pricePeriod.trim());
  }

  async function saveLatestForFigma(finalImageUrl?: string) {
    if (mode === "demo") return;
    // approvedSubject è ora un URL Blob pubblico (https://xxx.blob.vercel-storage.com/...)
    const personImageUrl = approvedSubject || apiPersonVariants[selectedVariant] || "";
    if (!personImageUrl) throw new Error("Soggetto non disponibile.");
    const res = await fetch("/api/figma/latest", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        campaignName:"TIM WiFi Casa",
        personImageUrl,   // URL Blob diretto — figma/latest lo salva nel KV
        headline:hero,
        priceLeft, priceRight:formatPriceRight(priceRight), pricePeriod,
        cta, legalNotes, legalNotice:legalNotes,
        finalImageUrl: finalImageUrl || finalPreview || undefined,
      }),
    });
    const data = await res.json().catch(()=>null);
    if (!res.ok) throw new Error(data?.error || "Salvataggio Figma non riuscito.");
  }

  async function finalizeCampaign() {
    if (mode === "demo") {
      setLoadingMerge(true);
      await new Promise(r => setTimeout(r,1800));
      setLoadingMerge(false);
      setCampaignStep("final");
      return;
    }
    try {
      setLoadingMerge(true);
      const personImageUrl = approvedSubject || apiPersonVariants[selectedVariant] || visualVariants[selectedVariant];
      const previewUrl = await composeCampaignPreview({
        subjectImageUrl: personImageUrl, headlineValue: hero,
        priceLeftValue: priceLeft, priceRightValue: priceRight,
        pricePeriodValue: pricePeriod, ctaValue: cta, legalValue: legalNotes,
        outputName: `generated-final-${Date.now()}.png`,
      });
      setFinalPreview(previewUrl);
      await saveLatestForFigma(previewUrl);
      setCampaignStep("final");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Errore finalizzazione.");
    } finally {
      setLoadingMerge(false);
    }
  }

  function goBack() {
    if (!flow) return;
    if (handoff) { setHandoff(false); return; }
    if (flow === "campaign") {
      if (campaignStep === "asset")   return resetAll();
      if (campaignStep === "subject") return setCampaignStep("asset");
      if (campaignStep === "visual")  return setCampaignStep("copy");
      if (campaignStep === "copy") {
        if (copyStage === "choice")    return setCampaignStep("subject");
        if (copyStage === "mood")      return setCopyStage("choice");
        if (copyStage === "proposals") return setCopyStage("mood");
        if (copyStage === "manual")    return setCopyStage("choice");
        if (copyStage === "price")     return setCopyStage(copyMode==="generated"?"proposals":"manual");
        if (copyStage === "summary")   return setCopyStage(copyMode==="generated"?"price":"manual");
      }
      if (campaignStep === "final") return setCampaignStep("visual");
    }
    resetAll();
  }

  // ── HOME ──────────────────────────────────────────────────────────────────
  function renderHome() {
    return (
      <div className="main-card home-card">
        <div className="home-inner">
          <h1 className="home-title">Cosa vuoi creare?</h1>
          <div className="home-options">
            <button className="home-option" onClick={()=>{ setFlow("campaign"); setCampaignStep("asset"); }}>
              <Icon src={icons.star} /><h2>Genera campagna</h2>
              <p>Visual e copy in un unico flusso.</p>
            </button>
            <div className="home-option home-option--soon">
              <Icon src={icons.profile} /><h2>Genera visual</h2>
              <p>Sostituisci la persona in un asset.</p>
              <span className="coming-soon-badge">Coming soon</span>
            </div>
            <div className="home-option home-option--soon">
              <Icon src={icons.document} /><h2>Genera copy</h2>
              <p>Crea testi da brief e obiettivo.</p>
              <span className="coming-soon-badge">Coming soon</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function currentTitle() {
    if (handoff)               return { icon:icons.figma,    title:"Pronto per Figma" };
    if (loadingMerge)          return { icon:icons.star,     title:"Preparo la campagna" };
    if (flow==="campaign") {
      if (campaignStep==="asset")   return { icon:icons.upload,   title:"Scegli il template" };
      if (campaignStep==="subject") return { icon:icons.profile,  title:"Definisci il soggetto" };
      if (campaignStep==="copy")    return { icon:icons.document,  title:"Imposta il copy" };
      if (campaignStep==="visual")  return { icon:icons.eye,      title:"Scegli il visual" };
      return { icon:icons.check, title: mode==="api" ? "Pronto per Figma" : "Campagna pronta" };
    }
    return { icon:icons.document, title:"Imposta il copy" };
  }

  function renderStepper() {
    if (!flow) return null;
    const steps = flow==="campaign" ? campaignSteps : campaignSteps.slice(0,3);
    const activeIndex = Math.max(0, steps.findIndex(s=>s.id===campaignStep));
    return (
      <div className="stepper">
        {steps.map((s,i)=>(
          <div key={s.id} className={`step-pill ${i<activeIndex?"done":""} ${i===activeIndex?"active":""}`}>
            <span className="index">{i<activeIndex?"✓":i+1}</span>{s.label}
          </div>
        ))}
      </div>
    );
  }

  // ── ASSET STEP ────────────────────────────────────────────────────────────
  function renderAssetStep() {
    const isSelected = uploadedAsset==="/templates/template-01-preview.png";
    return (
      <>
        <div className="template-select-wrap">
          <button className={`template-card ${isSelected?"selected":""}`}
            onClick={()=>setUploadedAsset("/templates/template-01-preview.png")}>
            <img src="/templates/template-01-preview.png" alt="Template 1" />
            <div className="template-card-footer"><span className="radio-dot" /><strong>Template 1</strong></div>
          </button>
          <div className="template-card template-card--soon">
            <div className="template-soon-placeholder"><span className="coming-soon-badge">Coming soon</span></div>
            <div className="template-card-footer"><span className="radio-dot" /><strong>Template 2</strong></div>
          </div>
          <div className="template-card template-card--soon">
            <div className="template-soon-placeholder"><span className="coming-soon-badge">Coming soon</span></div>
            <div className="template-card-footer"><span className="radio-dot" /><strong>Template 3</strong></div>
          </div>
        </div>
        <FooterActions onBack={goBack} primaryLabel="Continua" primaryDisabled={!isSelected}
          onPrimary={()=>setCampaignStep("subject")} />
      </>
    );
  }

  function OptionBlock({ icon, title, options, value, onChange }:
    { icon?:string; title:string; options:string[]; value:string; onChange:(v:string)=>void }) {
    return (
      <div className="option-card-light">
        <div className="mini-title"><Icon src={icon}/>{title}</div>
        <div className="chip-row">
          {options.map(o=>(
            <button key={o} className={`chip ${value===o?"active":""}`} onClick={()=>onChange(o)}>{o}</button>
          ))}
        </div>
      </div>
    );
  }

  // ── SUBJECT STEP — avvia generazione in background e passa subito al copy ─
  function renderSubjectStep() {
    return (
      <>
        <div className="subject-grid compact-subject-grid">
          <OptionBlock icon={icons.document} title="Formato"       options={["Verticale","Orizzontale","Quadrato"]}         value={format}      onChange={setFormat} />
          <OptionBlock icon={icons.profile}  title="Soggetto"      options={["Donna","Uomo","Coppia","Gruppo"]}             value={person}      onChange={setPerson} />
          <OptionBlock icon={icons.group}    title="Età"           options={["18-22","23-28","29-35","36-45"]}              value={age}         onChange={setAge} />
          <OptionBlock icon={icons.eye}      title="Volto"         options={["Mediterraneo","Nord Europeo","Latino","Asiatico"]} value={face}   onChange={setFace} />
          <OptionBlock icon={icons.profile}  title="Capelli"       options={["Corti","Medi","Lunghi"]}                      value={hair}        onChange={setHair} />
          <OptionBlock icon={icons.star}     title="Colore capelli" options={["Biondo","Castano","Nero"]}                   value={hairColor}   onChange={setHairColor} />
          <OptionBlock icon={icons.eye}      title="Espressione"   options={["Naturale","Sorridente","Entusiasta"]}         value={expression}  onChange={setExpression} />
          <OptionBlock icon={icons.document} title="Outfit"        options={["Hipster","Urban Casual","Streetwear Premium","Smart Casual"]} value={outfit} onChange={setOutfit} />
          <OptionBlock icon={icons.star}     title="Colore top"    options={["#0033A1","#EB0028","#FFFFFF"]}                value={topColor}    onChange={setTopColor} />
          <OptionBlock icon={icons.group}    title="Target"        options={["Gen Z","Young Adult","Family","Premium"]}     value={target}      onChange={setTarget} />
          <OptionBlock icon={icons.star}     title="Mood"          options={["Quotidiano","Premium","Editoriale","Hero Campaign"]} value={visualMood} onChange={setVisualMood} />
          <OptionBlock icon={icons.document} title="Smartphone"    options={["Mantieni orientamento originale","Verticale","Orizzontale"]} value={smartphone} onChange={setSmartphone} />
        </div>
        <FooterActions
          onBack={goBack}
          primaryLabel={mode==="api" ? "Genera soggetto" : "Continua"}
          primaryVariant="danger"
          onPrimary={()=>{
            if (mode==="api") {
              // Avvia generazione IN BACKGROUND, poi va subito al copy
              generateSubjectBackground();
            } else {
              // Demo: avvia finta generazione in background
              setGenStatus("running");
              startGenProgress();
              setTimeout(()=>{ stopGenProgress(); setGenStatus("done"); }, 4000);
            }
            setCampaignStep("copy");
          }}
        />
      </>
    );
  }

  // ── COPY STEP (con banner di generazione background visibile) ─────────────
  function renderCopyChoice() {
    return (
      <>
        <div className="copy-choice-head"><h2>Come vuoi scrivere il copy?</h2></div>
        <div className="copy-mode-grid">
          <button className="copy-mode-card" onClick={()=>{ setCopyMode("generated"); setCopyStage("mood"); }}>
            <Icon src={icons.star}/><h3>Genera proposte</h3>
            <p>Parti da un mood e scegli tra più alternative.</p>
          </button>
          <button className="copy-mode-card" onClick={()=>{ setCopyMode("manual"); setCopyStage("manual"); }}>
            <Icon src={icons.document}/><h3>Scrivi manualmente</h3>
            <p>Inserisci direttamente hero, CTA e prezzo.</p>
          </button>
        </div>
        <FooterActions onBack={goBack} hidePrimary />
      </>
    );
  }

  function renderMoodStep() {
    return (
      <>
        <div className="form-panel mood-panel">
          <label className="field-label">Mood campagna</label>
          <p className="field-description">Descrivi il tono dei testi.</p>
          <div className="field-with-count">
            <textarea value={mood} onChange={e=>setMood(e.target.value.slice(0,CHAR_LIMITS.mood))}
              placeholder="Es. semplice, giovane, domestico, positivo..." />
            <CharCount value={mood} max={CHAR_LIMITS.mood} />
          </div>
        </div>
        <FooterActions onBack={goBack} primaryLabel={loadingCopy?"Generazione…":"Genera proposte"}
          primaryDisabled={!mood.trim()||loadingCopy} onPrimary={generateProposals} />
      </>
    );
  }

  function renderGeneratedProposals() {
    return (
      <>
        <div className="proposals-layout">
          <div className="choice-grid">
            <div className="choice-panel">
              <h3>Hero</h3>
              {heroOptions.map(o=>(
                <button key={o} className={`radio-option ${hero===o?"active":""}`} onClick={()=>setHero(o)}>
                  <span className="radio-dot"/>{o}
                </button>
              ))}
            </div>
            <div className="choice-panel">
              <h3>CTA</h3>
              {ctaOptions.map(o=>(
                <button key={o} className={`radio-option ${cta===o?"active":""}`} onClick={()=>setCta(o)}>
                  <span className="radio-dot"/>{o}
                </button>
              ))}
            </div>
          </div>
          <div className="copy-editor-row">
            <div className="copy-editor-field">
              <div className="copy-editor-label-row">
                <label className="field-label">Hero finale</label><CharCount value={hero} max={CHAR_LIMITS.hero}/>
              </div>
              <input className="text-input" value={hero}
                onChange={e=>setHero(e.target.value.slice(0,CHAR_LIMITS.hero))}
                placeholder="Seleziona una variante o scrivi da zero"/>
            </div>
            <div className="copy-editor-field">
              <div className="copy-editor-label-row">
                <label className="field-label">CTA finale</label><CharCount value={cta} max={CHAR_LIMITS.cta}/>
              </div>
              <input className="text-input" value={cta}
                onChange={e=>setCta(e.target.value.slice(0,CHAR_LIMITS.cta))}
                placeholder="Seleziona una variante o scrivi da zero"/>
            </div>
          </div>
        </div>
        <FooterActions onBack={goBack} primaryLabel="Continua"
          primaryDisabled={!hero.trim()||!cta.trim()} onPrimary={()=>setCopyStage("price")} />
      </>
    );
  }

  function renderPriceFields() {
    return (
      <div className="price-panel">
        <label className="field-label">Prezzo</label>
        <div className="price-grid">
          <input className="price-input" value={priceLeft}   onChange={e=>setPriceLeft(e.target.value)}   placeholder="24"/>
          <input className="price-input" value={priceRight}  onChange={e=>setPriceRight(e.target.value)}  placeholder="90"/>
          <input className="price-input" value={pricePeriod} onChange={e=>setPricePeriod(e.target.value)} placeholder="mese"/>
        </div>
        <p className="helper-text">Esempio: da 24,90 € / mese.</p>
        <div className="copy-editor-label-row legal-label">
          <label className="field-label" style={{marginBottom:0}}>Note legali</label>
          <CharCount value={legalNotes} max={CHAR_LIMITS.legal}/>
        </div>
        <textarea className="legal-input" value={legalNotes}
          onChange={e=>setLegalNotes(e.target.value.slice(0,CHAR_LIMITS.legal))}
          placeholder="Es. Offerta soggetta a copertura e disponibilità tecnica…"
          maxLength={CHAR_LIMITS.legal}/>
      </div>
    );
  }

  function renderManualCopy() {
    return (
      <>
        <div className="manual-copy-layout">
          <div className="input-grid">
            <div className="form-panel">
              <div className="copy-editor-label-row">
                <label className="field-label">Hero</label><CharCount value={hero} max={CHAR_LIMITS.hero}/>
              </div>
              <input className="text-input" value={hero}
                onChange={e=>setHero(e.target.value.slice(0,CHAR_LIMITS.hero))}
                placeholder="Es. Qui navigo alla grande" maxLength={CHAR_LIMITS.hero}/>
            </div>
            <div className="form-panel">
              <div className="copy-editor-label-row">
                <label className="field-label">CTA</label><CharCount value={cta} max={CHAR_LIMITS.cta}/>
              </div>
              <input className="text-input" value={cta}
                onChange={e=>setCta(e.target.value.slice(0,CHAR_LIMITS.cta))}
                placeholder="Es. Scegli TIM WiFi CASA" maxLength={CHAR_LIMITS.cta}/>
            </div>
          </div>
          {renderPriceFields()}
        </div>
        <FooterActions onBack={goBack} primaryLabel="Riepilogo"
          primaryDisabled={!canContinueFromPrice()} onPrimary={()=>setCopyStage("summary")}/>
      </>
    );
  }

  function renderPriceStep() {
    return (
      <>
        {renderPriceFields()}
        <FooterActions onBack={goBack} primaryLabel="Rivedi"
          primaryDisabled={!canContinueFromPrice()} onPrimary={()=>setCopyStage("summary")}/>
      </>
    );
  }

  function renderSummaryStep() {
    // Dopo il riepilogo: se la generazione visual è ancora in corso → mostra attesa
    // Se è done → va direttamente allo step visual
    const goToVisual = () => {
      setCampaignStep("visual");
      setCopyStage("choice"); // reset per eventuali ritorni
    };

    return (
      <>
        <div className="summary-panel">
          <h2>Riepilogo</h2>
          <div className="summary-list">
            <div className="summary-item"><span>Hero</span><strong>{hero}</strong></div>
            <div className="summary-item"><span>Prezzo</span><strong>{priceForSummary(priceLeft,priceRight,pricePeriod)}</strong></div>
            <div className="summary-item"><span>CTA</span><strong>{cta}</strong></div>
            <div className="summary-item"><span>Note legali</span><strong>{legalNotes||"—"}</strong></div>
          </div>

          {/* Stato generazione visual */}
          {mode==="api" && genStatus==="running" && (
            <div className="summary-gen-wait">
              <span className="gen-spinner" />
              <span>Generazione visual in corso ({genProgress}%)… attendere prima di scegliere.</span>
            </div>
          )}
          {mode==="api" && genStatus==="done" && (
            <div className="summary-gen-ready">✓ Visual pronti — puoi procedere alla scelta.</div>
          )}
          {mode==="api" && genStatus==="error" && (
            <div className="summary-gen-error">⚠ Generazione visual fallita. Torna al soggetto e riprova.</div>
          )}
        </div>

        <FooterActions onBack={goBack} primaryLabel="Scegli il visual" primaryVariant="danger"
          primaryDisabled={mode==="api" && genStatus==="running"}
          onPrimary={()=>{
            if (mode==="demo") { finalizeCampaign(); return; }
            goToVisual();
          }}/>
      </>
    );
  }

  function renderCopyStep() {
    if (copyStage==="choice")    return renderCopyChoice();
    if (copyStage==="mood")      return renderMoodStep();
    if (copyStage==="proposals") return renderGeneratedProposals();
    if (copyStage==="manual")    return renderManualCopy();
    if (copyStage==="price")     return renderPriceStep();
    return renderSummaryStep();
  }

  // ── VISUAL STEP — scelta tra le varianti generate ─────────────────────────
  function renderVisualStep() {
    return (
      <>
        <div className={`variant-layout ${mode==="api"?"subject-variant-layout":""}`}>
          <div className={`hero-preview ${mode==="api"?"subject-preview":""}`}>
            <img src={visualVariants[selectedVariant]} alt={`Variante ${selectedVariant+1}`}/>
          </div>
          <div className="thumb-stack">
            {visualVariants.map((src,i)=>(
              <button key={`${src}-${i}`}
                className={`selectable-thumb ${selectedVariant===i?"selected":""}`}
                onClick={()=>{ setSelectedVariant(i); if(mode==="api") setApprovedSubject(apiPersonVariants[i]||src); }}>
                <span className="radio-dot"/>
                <img src={src} alt={`Variante ${i+1}`}/>
                <p>Variante {i+1}</p>
              </button>
            ))}
          </div>
        </div>
        <FooterActions onBack={goBack} primaryLabel={loadingMerge?"Compositing…":"Unisci e finalizza"}
          primaryVariant="danger" primaryDisabled={loadingMerge}
          onPrimary={()=>{
            if (mode==="api") setApprovedSubject(apiPersonVariants[selectedVariant]||visualVariants[selectedVariant]);
            finalizeCampaign();
          }}/>
      </>
    );
  }

  // ── FINAL STEP ────────────────────────────────────────────────────────────
  function renderFinalStep() {
    const subject = finalPreview || approvedSubject || visualVariants[selectedVariant];
    if (mode==="api") {
      if (handoff) return (
        <>
          <div className="handoff-screen api-handoff-screen">
            <Icon src={icons.figma} className="handoff-figma-icon"/>
            <h2>Vai su Figma</h2>
            <p>Apri il plugin UltraStudio e clicca "Applica alle tavole".</p>
            <div className="handoff-actions">
              <button className="btn secondary" onClick={resetAll}>Nuova campagna</button>
            </div>
          </div>
          <FooterActions onBack={goBack} hidePrimary/>
        </>
      );
      return (
        <>
          <div className="api-final-layout">
            <div className="api-subject-card">
              <p className="field-label">Anteprima finale</p>
              <div className="api-subject-preview">
                {subject ? <img src={subject} alt="Anteprima"/> : <span>Non disponibile</span>}
              </div>
            </div>
            <div className="api-final-summary">
              <Icon src={icons.figma} className="api-final-icon"/>
              <h2>Pronto per Figma</h2>
              <p>Il plugin applicherà soggetto, hero, prezzo, CTA e note legali.</p>
              <div className="api-data-list">
                <div><span>Hero</span><strong>{hero}</strong></div>
                <div><span>Prezzo</span><strong>{priceForSummary(priceLeft,priceRight,pricePeriod)}</strong></div>
                <div><span>CTA</span><strong>{cta}</strong></div>
                <div><span>Note legali</span><strong>{legalNotes||"—"}</strong></div>
              </div>
              <div className="button-row" style={{flexDirection:"column",alignItems:"stretch",gap:"10px"}}>
                <button className="btn dark" onClick={()=>setHandoff(true)}><Icon src={icons.figma}/>Upload su Figma</button>
                {subject && (
                  <a className="btn secondary" href={subject} download="ultrastudio-campaign.png" target="_blank" rel="noreferrer">
                    <Icon src={icons.download}/>Scarica immagine
                  </a>
                )}
              </div>
            </div>
          </div>
          <FooterActions onBack={goBack} hidePrimary/>
        </>
      );
    }

    if (handoff) return (
      <>
        <div className="handoff-screen">
          <Icon src={icons.figma} className="handoff-figma-icon"/>
          <h2>Pronto per Figma</h2>
          <p>Apri il plugin UltraStudio: applicherà l'asset a tutte le declinazioni.</p>
          <div className="handoff-preview"><img src={finalCampaign} alt="Campagna finale"/></div>
          <div className="handoff-actions">
            <a className="btn primary" href={finalCampaign} download="ultrastudio-campaign.png">
              <Icon src={icons.download}/>Scarica immagine
            </a>
            <button className="btn secondary" onClick={resetAll}>Nuova campagna</button>
          </div>
        </div>
        <FooterActions onBack={goBack} hidePrimary/>
      </>
    );

    return (
      <>
        <div className="final-layout">
          <div className="final-preview-card"><img src={finalCampaign} alt="Campagna finale"/></div>
          <div className="final-action-card">
            <h2>Campagna pronta</h2>
            <p>Scarica l'immagine o completa l'applicazione sulle tavole Figma.</p>
            <div className="button-row" style={{flexDirection:"column",alignItems:"stretch"}}>
              <a className="btn primary" href={finalCampaign} download="ultrastudio-campaign.png">
                <Icon src={icons.download}/>Scarica immagine
              </a>
              <button className="btn dark" onClick={()=>setHandoff(true)}><Icon src={icons.figma}/>Upload su Figma</button>
            </div>
          </div>
        </div>
        <FooterActions onBack={goBack} hidePrimary/>
      </>
    );
  }

  function renderStep() {
    if (loadingMerge) return (
      <div className="loading-state">
        <div className="loader-icon"><span className="spinner-mark"/></div>
        <h2>Preparo la campagna</h2>
        <p>Compositing in corso…</p>
      </div>
    );
    if (flow==="campaign") {
      if (campaignStep==="asset")   return renderAssetStep();
      if (campaignStep==="subject") return renderSubjectStep();
      if (campaignStep==="copy")    return renderCopyStep();
      if (campaignStep==="visual")  return renderVisualStep();
      return renderFinalStep();
    }
    return null;
  }

  const title = currentTitle();

  return (
    <div className="app-shell">
      <div className="top-bar">
        <button className="icon-button" onClick={resetAll} aria-label="Home"><Icon src={icons.home}/></button>
        <div className="logo-wrap"><img src="/logo-ultrastudio.png" alt="UltraStudio"/></div>
        <div className="mode-wrap">
          <div className="mode-toggle">
            <button className={mode==="demo"?"active":""} onClick={()=>setMode("demo")}>Demo</button>
            <button className={mode==="api" ?"active":""} onClick={()=>setMode("api")}>API</button>
          </div>
        </div>
      </div>

      {/* Banner generazione in background — sempre visibile quando attivo */}
      {flow && <GenBanner status={genStatus} progress={genProgress}/>}

      <div className="stage-center">
        {!flow ? renderHome() : (
          <div className="main-card">
            <div className="step-title-row">
              <Icon src={title.icon}/><h1>{title.title}</h1>
            </div>
            {renderStepper()}
            <div className="step-content">{renderStep()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function FooterActions({ onBack, onPrimary, primaryLabel="Continua", primaryDisabled=false,
  primaryVariant="primary", hidePrimary=false }: {
  onBack:()=>void; onPrimary?:()=>void; primaryLabel?:string;
  primaryDisabled?:boolean; primaryVariant?:"primary"|"danger"|"secondary"; hidePrimary?:boolean;
}) {
  return (
    <div className="footer-actions">
      <button className="btn secondary" onClick={onBack}>Indietro</button>
      {!hidePrimary && (
        <button className={`btn ${primaryVariant}`} disabled={primaryDisabled} onClick={onPrimary}>
          {primaryLabel}
        </button>
      )}
    </div>
  );
}
