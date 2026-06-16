export type FlowType = "visual" | "copy";

export type CampaignConfig = {
  flow: FlowType;
  brief: string;
  target: string;
  channel: string;
  objective: string;
  subject: string;
  age: string;
  look: string;
  outfit: string;
  mood: string;
};

export function buildVisualPrompt(config: CampaignConfig) {
  return `
You are an expert advertising art director for TIM.

TASK
Adapt the uploaded campaign key visual by changing only the human subject.
Preserve layout, product, device, brand elements, composition, lighting direction and campaign structure.

CAMPAIGN CONTEXT
Brief: ${config.brief || "No brief provided"}
Target: ${config.target}
Channel: ${config.channel}
Objective: ${config.objective}

SUBJECT TO GENERATE
Subject: ${config.subject}
Age: ${config.age}
Look: ${config.look}
Outfit: ${config.outfit}
Mood: ${config.mood}

STRICT RULES
- Do not alter the product, phone, logo, layout or existing visual hierarchy.
- Do not add text, claims, random logos or new UI elements.
- Replace only the person/subject according to the selected attributes.
- Keep the final image clean, premium and campaign-ready.
- If a person is present, keep body proportions natural and realistic.
`.trim();
}

export function buildCopyPrompt(config: CampaignConfig) {
  return `
Sei un senior copywriter e creative strategist per TIM.

Genera copy advertising in italiano partendo da questi parametri.

BRIEF
${config.brief || "Generare una campagna TIM chiara, contemporanea e orientata al valore."}

PARAMETRI
- Target: ${config.target}
- Canale: ${config.channel}
- Obiettivo: ${config.objective}
- Mood: ${config.mood}
- Soggetto/immaginario: ${config.subject}, ${config.age}, ${config.look}, ${config.outfit}

OUTPUT
- 4 headline brevi
- 4 bodycopy brevi
- 4 CTA
- 2 caption social

VINCOLI
- Scrivi in italiano.
- Evita claim assoluti o non verificabili.
- Non citare prezzi, promo o condizioni non presenti nel brief.
- Mantieni tono chiaro, premium, contemporaneo e coerente con TIM.
- Non spiegare il processo: restituisci solo il copy.
`.trim();
}
