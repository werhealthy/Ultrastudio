import { BadgeCheck, FileText, ImagePlus, Layers3, PenLine, Sparkles, UploadCloud, UserRound } from "lucide-react";

export type StudioStepId = "setup" | "keyVisual" | "subject" | "approve" | "campaignKit" | "copyExport";

export type StudioStep = {
  id: StudioStepId;
  index: string;
  label: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
};

export const studioSteps: StudioStep[] = [
  {
    id: "setup",
    index: "01",
    label: "Setup",
    title: "Imposta la campagna",
    description: "Brief, target, canale e obiettivo: la base comune per visual e copy.",
    icon: PenLine,
  },
  {
    id: "keyVisual",
    index: "02",
    label: "Key visual",
    title: "Carica l’asset principale",
    description: "Il sistema deve preservare layout, brand, prodotto e composizione.",
    icon: UploadCloud,
  },
  {
    id: "subject",
    index: "03",
    label: "Soggetto",
    title: "Definisci la persona",
    description: "Parametri controllati per modificare solo il soggetto della pubblicità.",
    icon: UserRound,
  },
  {
    id: "approve",
    index: "04",
    label: "Approve",
    title: "Conferma il soggetto",
    description: "Scegli la variante migliore: diventa la reference ufficiale della campagna.",
    icon: BadgeCheck,
  },
  {
    id: "campaignKit",
    index: "05",
    label: "Campaign kit",
    title: "Applica agli altri asset",
    description: "Carica i formati della campagna e propaga lo stesso soggetto approvato.",
    icon: Layers3,
  },
  {
    id: "copyExport",
    index: "06",
    label: "Copy & export",
    title: "Genera copy ed esporta",
    description: "Headline, CTA e caption coerenti con i parametri della campagna.",
    icon: FileText,
  },
];

export const subjectOptions = {
  subject: ["Donna", "Uomo", "Coppia", "Gruppo"],
  age: ["18–22", "23–28", "29–35", "36–45"],
  face: ["Mediterraneo", "Nord europeo", "Latino", "Asiatico"],
  hair: ["Corti castani", "Corti rosa", "Medi biondi", "Lunghi neri"],
  expression: ["Naturale", "Sorridente", "Entusiasta", "Editoriale"],
  outfit: ["Urban casual", "Streetwear premium", "Smart casual", "Minimal tech"],
  mood: ["Premium quotidiano", "Hero campaign", "Editoriale", "Gen Z pop"],
};

export const campaignKitAssets = [
  { name: "Hero desktop", format: "1920 × 800", status: "Pronto per adattamento" },
  { name: "Social post", format: "1080 × 1080", status: "Da caricare" },
  { name: "Story/Reel cover", format: "1080 × 1920", status: "Da caricare" },
  { name: "Display banner", format: "300 × 600", status: "Da caricare" },
];

export const copyVariants = [
  {
    label: "Headline",
    value: "La tua esperienza digitale, più vicina a te.",
  },
  {
    label: "Bodycopy",
    value: "UltraStudio mantiene la coerenza del visual e genera messaggi allineati a target, canale e obiettivo della campagna.",
  },
  {
    label: "CTA",
    value: "Scopri di più",
  },
  {
    label: "Caption social",
    value: "Un solo soggetto, una campagna coerente su tutti i formati. Dal key visual al kit finale, con controllo creativo umano.",
  },
];

export const variantCards = ["A", "B", "C", "D"];

export const promptRules = [
  "Mantieni layout e formato dell’asset originale.",
  "Non alterare prodotto, loghi, testi e branding.",
  "Sostituisci solo il soggetto secondo i parametri scelti.",
  "Usa il soggetto approvato come reference per gli asset successivi.",
];
