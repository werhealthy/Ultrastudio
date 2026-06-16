export type VisualPromptInput = {
  format?: string;
  person?: string;
  age?: string;
  face?: string;
  hair?: string;
  hairColor?: string;
  expression?: string;
  outfit?: string;
  topColor?: string;
  target?: string;
  mood?: string;
  smartphone?: string;
  variantIndex?: number;
};

export function buildVisualPrompt(input: VisualPromptInput) {
  const variantDirections = [
    "mantieni una posa naturale, frontale o leggermente di tre quarti",
    "varia leggermente atteggiamento e postura mantenendo coerenza advertising",
    "crea una variante più dinamica ma sempre realistica e credibile",
  ];

  const variantNote = input.variantIndex != null
    ? `\nVariante ${input.variantIndex + 1}: ${variantDirections[input.variantIndex] || variantDirections[0]}.`
    : "";

  return `
Generate ONLY the isolated human subject, not the full advertising campaign.
The subject should be framed like a premium advertising cut-out for a telecom campaign: vertical human figure, visible from at least mid-thigh or full body when possible, holding or using a smartphone naturally.
Do not include logos, texts, prices, red buttons, TIM graphic blocks, layouts, background graphics or placeholders.
Do not create black rectangles, frames, overlays or extra visual elements.

The subject must be suitable for later compositing inside a TIM campaign template.
The output must look like a high-end campaign cut-out subject shot, not a generic stock photo.

STRICT SUBJECT REQUIREMENTS
- Subject: ${input.person || "Donna"}
- Age: ${input.age || "23-28"}
- Face / ethnicity direction: ${input.face || "Mediterraneo"}
- Hair length: ${input.hair || "Medi"}
- Hair color: ${input.hairColor || "Castano"}
- Expression: ${input.expression || "Naturale"}
- Outfit: ${input.outfit || "Urban Casual"}
- Top color: exactly ${input.topColor || "#0033A1"}. The main visible top / shirt / sweater must match this color as closely as possible.
- Target attitude: ${input.target || "Young Adult"}
- Mood: ${input.mood || "Quotidiano"}
- Format direction: ${input.format || "Verticale"}
- Smartphone/device: ${input.smartphone || "Mantieni orientamento originale"}

QUALITY REQUIREMENTS
- photorealistic premium advertising quality
- clean studio lighting
- natural skin texture and realistic hands
- credible body proportions
- clean white background suitable for background removal
- subject clearly separated from background
- no text, no logos, no campaign layout
- no duplicated limbs, no distorted hands, no distorted phone
- no full campaign scene
- plain white background only, no black blocks, no dark panels, no censor bars

OUTPUT
One isolated photorealistic subject, high resolution, clean white background, ready for background removal and compositing.${variantNote}
`.trim();
}

export function buildCopyPrompt(mood: string) {
  return `
Sei un senior copywriter per campagne TIM.

Genera proposte brevi e immediate per una campagna TIM WiFi Casa.
Il tono deve seguire questo mood: ${mood}

Output richiesto esclusivamente in JSON valido, senza markdown:
{
  "heroOptions": ["...", "...", "..."],
  "ctaOptions": ["...", "...", "..."]
}

Regole:
- Le hero devono essere brevi, memorabili, massimo 5 parole.
- Le CTA devono essere azioni brevi, massimo 4 parole.
- Lingua italiana.
- Tono semplice, positivo, contemporaneo.
- Non usare claim troppo tecnici o lunghi.
`.trim();
}
