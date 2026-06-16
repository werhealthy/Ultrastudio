import type { CampaignStep, CharacterConfig } from "./campaign-types";

export const campaignSteps: CampaignStep[] = [
  {
    id: "setup",
    eyebrow: "01",
    title: "Campaign setup",
    description: "Definisci il contesto creativo: target, canale e obiettivo della campagna.",
  },
  {
    id: "character",
    eyebrow: "02",
    title: "Create character",
    description: "Carica il key visual e modifica solo il soggetto tramite parametri controllati.",
  },
  {
    id: "approve",
    eyebrow: "03",
    title: "Approve character",
    description: "Scegli il soggetto migliore e trasformalo nella reference ufficiale della campagna.",
  },
  {
    id: "output",
    eyebrow: "04",
    title: "Campaign output",
    description: "Rivedi visual e copy affiancati, poi scarica gli asset finali.",
  },
];

export const defaultCharacterConfig: CharacterConfig = {
  subject: "Donna",
  age: "23–28",
  face: "Mediterraneo",
  hair: "Corti, castani",
  outfit: "Urban casual",
  mood: "Premium quotidiano",
};
