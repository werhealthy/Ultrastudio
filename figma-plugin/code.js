figma.showUI(__html__, { width: 420, height: 620, themeColors: false });

const PERSON_SLOT_NAME     = "US_PERSON_SLOT";
const HEADLINE_SLOT_NAME   = "US_COPY_HEADLINE";
const PRICE_LEFT_SLOT_NAME = "US_PRICE_LEFT";
const PRICE_RIGHT_SLOT_NAME= "US_PRICE_RIGHT";
const PRICE_PERIOD_SLOT_NAME="US_PRICE_PERIOD";
const PRICE_PREFIX_SLOT_NAME="US_PRICE_PREFIX";
const CTA_SLOT_NAME        = "US_COPY_CTA";

function matchesSlot(node, slotName) {
  const name = (node.name || "").trim().toUpperCase();
  return name === slotName || name.startsWith(slotName + "_") || name.startsWith(slotName + " ");
}

function isWritableGeometryNode(node) {
  return "fills" in node && Array.isArray(node.fills);
}

function findImageSlots() {
  return figma.currentPage.findAll(n => matchesSlot(n, PERSON_SLOT_NAME) && isWritableGeometryNode(n));
}

function findTextSlots(slotName) {
  return figma.currentPage.findAll(n => matchesSlot(n, slotName) && n.type === "TEXT");
}

function scanCanvas() {
  return {
    imageSlots:      findImageSlots().length,
    headlineSlots:   findTextSlots(HEADLINE_SLOT_NAME).length,
    priceLeftSlots:  findTextSlots(PRICE_LEFT_SLOT_NAME).length,
    priceRightSlots: findTextSlots(PRICE_RIGHT_SLOT_NAME).length,
    pricePeriodSlots:findTextSlots(PRICE_PERIOD_SLOT_NAME).length,
    pricePrefixSlots:findTextSlots(PRICE_PREFIX_SLOT_NAME).length,
    ctaSlots:        findTextSlots(CTA_SLOT_NAME).length,
  };
}

async function loadFontsForTextNode(node) {
  try {
    if (node.characters.length > 0 && node.fontName === figma.mixed) {
      const fonts = node.getRangeAllFontNames(0, node.characters.length);
      const unique = [];
      for (const f of fonts) {
        if (!unique.some(u => u.family === f.family && u.style === f.style)) unique.push(f);
      }
      await Promise.all(unique.map(f => figma.loadFontAsync(f)));
      return;
    }
    if (node.fontName !== figma.mixed) {
      await figma.loadFontAsync(node.fontName);
      return;
    }
  } catch (_e) {}
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
  const totalText = scan.headlineSlots + scan.priceLeftSlots + scan.priceRightSlots +
    scan.pricePeriodSlots + scan.pricePrefixSlots + scan.ctaSlots;

  if (!imageSlots.length && !totalText) {
    throw new Error("Nessun layer UltraStudio trovato nella pagina corrente.");
  }

  if (imageSlots.length && payload.personImageBytes && payload.personImageBytes.length) {
    const imageBytes = Uint8Array.from(payload.personImageBytes);
    const image = figma.createImage(imageBytes);
    for (const node of imageSlots) {
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
    }
  }

  const headlineSlots   = await replaceText(HEADLINE_SLOT_NAME,    payload.headline   || "");
  const priceLeftSlots  = await replaceText(PRICE_LEFT_SLOT_NAME,  payload.priceLeft  || "");
  const priceRightSlots = await replaceText(PRICE_RIGHT_SLOT_NAME, payload.priceRight || "");
  const pricePeriodSlots= await replaceText(PRICE_PERIOD_SLOT_NAME,payload.pricePeriod|| "");
  const pricePrefixSlots= await replaceText(PRICE_PREFIX_SLOT_NAME,"");
  const ctaSlots        = await replaceText(CTA_SLOT_NAME,         payload.cta        || "");

  return {
    imageSlots: imageSlots.length,
    headlineSlots, priceLeftSlots, priceRightSlots,
    pricePeriodSlots, pricePrefixSlots, ctaSlots,
    textSlots: headlineSlots + priceLeftSlots + priceRightSlots +
               pricePeriodSlots + pricePrefixSlots + ctaSlots,
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
    figma.notify(`UltraStudio: ${result.imageSlots} asset e ${result.textSlots} testi aggiornati.`);
  } catch (error) {
    const text = error && error.message ? error.message : "Applicazione non riuscita.";
    figma.ui.postMessage({ type: "apply-error", message: text });
    figma.notify(`UltraStudio: ${text}`);
  }
};

figma.ui.postMessage({ type: "scan-result", result: scanCanvas() });
