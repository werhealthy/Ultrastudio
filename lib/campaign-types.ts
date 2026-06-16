export type CampaignStepId = "setup" | "character" | "approve" | "output";

export type CampaignStep = {
  id: CampaignStepId;
  eyebrow: string;
  title: string;
  description: string;
};

export type CharacterConfig = {
  subject: string;
  age: string;
  face: string;
  hair: string;
  outfit: string;
  mood: string;
};
