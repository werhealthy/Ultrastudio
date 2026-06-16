figma.showUI(__html__, { width: 390, height: 500, themeColors: false });

const PERSON_SLOT_NAME = "US_PERSON_SLOT";
const HEADLINE_SLOT_NAME = "US_COPY_HEADLINE";
const PRICE_LEFT_SLOT_NAME = "US_PRICE_LEFT";
const PRICE_RIGHT_SLOT_NAME = "US_PRICE_RIGHT";
const PRICE_PERIOD_SLOT_NAME = "US_PRICE_PERIOD";
const PRICE_PREFIX_SLOT_NAME = "US_PRICE_PREFIX";
const CTA_SLOT_NAME = "US_COPY_CTA";

function normalizedName(node) {
  return (node.name || "").trim().toUpperCase();
}

function matchesSlot(node, slotName) {
  const name = normalizedName(node);
  return name === slotName || name.startsWith(slotName + "_") || name.startsWith(slotName + " ");
}

function isWritableGeometryNode(node) {
  return "fills" in node && Array.isArray(node.fills);
}

function findImageSlots() {
  return figma.currentPage.findAll((node) => matchesSlot(node, PERSON_SLOT_NAME) && isWritableGeometryNode(node));
}

function findTextSlots(slotName) {
  return figma.currentPage.findAll((node) => matchesSlot(node, slotName) && node.type === "TEXT");
}

function scanCanvas() {
  const imageSlots = findImageSlots().length;
  const headlineSlots = findTextSlots(HEADLINE_SLOT_NAME).length;
  const priceLeftSlots = findTextSlots(PRICE_LEFT_SLOT_NAME).length;
  const priceRightSlots = findTextSlots(PRICE_RIGHT_SLOT_NAME).length;
  const pricePeriodSlots = findTextSlots(PRICE_PERIOD_SLOT_NAME).length;
  const pricePrefixSlots = findTextSlots(PRICE_PREFIX_SLOT_NAME).length;
  const ctaSlots = findTextSlots(CTA_SLOT_NAME).length;

  return {
    imageSlots,
    headlineSlots,
    priceLeftSlots,
    priceRightSlots,
    pricePeriodSlots,
    pricePrefixSlots,
    ctaSlots,
    textSlots: headlineSlots + priceLeftSlots + priceRightSlots + pricePeriodSlots + pricePrefixSlots + ctaSlots,
  };
}

async function loadFontsForTextNode(node) {
  try {
    if (node.characters.length > 0 && node.fontName === figma.mixed) {
      const fonts = node.getRangeAllFontNames(0, node.characters.length);
      const uniqueFonts = [];

      for (const font of fonts) {
        const exists = uniqueFonts.some((item) => item.family === font.family && item.style === font.style);
        if (!exists) uniqueFonts.push(font);
      }

      await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
      return;
    }

    if (node.fontName !== figma.mixed) {
      await figma.loadFontAsync(node.fontName);
      return;
    }
  } catch (_error) {
    // fallback below
  }

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  node.fontName = { family: "Inter", style: "Regular" };
}

async function replaceText(slotName, value) {
  const nodes = findTextSlots(slotName);

  for (const node of nodes) {
    await loadFontsForTextNode(node);
    node.characters = value || "";
  }

  return nodes.length;
}

async function applyToCanvas(payload) {
  const imageSlots = findImageSlots();
  const scan = scanCanvas();

  if (!imageSlots.length && !scan.textSlots) {
    throw new Error("Nessun layer UltraStudio trovato nella pagina corrente.");
  }

  if (imageSlots.length) {
    const imageBytes = Uint8Array.from(payload.personImageBytes || []);
    if (!imageBytes.length) throw new Error("Asset non disponibile.");

    const image = figma.createImage(imageBytes);
    const imageHash = image.hash;

    for (const node of imageSlots) {
      node.fills = [{ type: "IMAGE", imageHash, scaleMode: "FIT" }];
    }
  }

  const headlineSlots = await replaceText(HEADLINE_SLOT_NAME, payload.headline);
  const priceLeftSlots = await replaceText(PRICE_LEFT_SLOT_NAME, payload.priceLeft);
  const priceRightSlots = await replaceText(PRICE_RIGHT_SLOT_NAME, payload.priceRight);
  const pricePeriodSlots = await replaceText(PRICE_PERIOD_SLOT_NAME, payload.pricePeriod);
  const pricePrefixSlots = await replaceText(PRICE_PREFIX_SLOT_NAME, "");
  const ctaSlots = await replaceText(CTA_SLOT_NAME, payload.cta);

  return {
    imageSlots: imageSlots.length,
    headlineSlots,
    priceLeftSlots,
    priceRightSlots,
    pricePeriodSlots,
    pricePrefixSlots,
    ctaSlots,
    textSlots: headlineSlots + priceLeftSlots + priceRightSlots + pricePeriodSlots + pricePrefixSlots + ctaSlots,
  };
}

figma.ui.onmessage = async (message) => {
  if (message.type === "scan-ultrastudio") {
    figma.ui.postMessage({ type: "scan-result", result: scanCanvas() });
    return;
  }

  if (message.type !== "apply-ultrastudio") return;

  try {
    const result = await applyToCanvas(message.payload || {});
    figma.ui.postMessage({ type: "apply-success", result });
    figma.notify(`UltraStudio: aggiornati ${result.imageSlots} asset e ${result.textSlots} testi.`);
  } catch (error) {
    const text = error && error.message ? error.message : "Applicazione non riuscita.";
    figma.ui.postMessage({ type: "apply-error", message: text });
    figma.notify(`UltraStudio: ${text}`);
  }
};

figma.ui.postMessage({ type: "scan-result", result: scanCanvas() });
