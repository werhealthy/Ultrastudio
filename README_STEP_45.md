# UltraStudio Step 45 — precise HTML/Sharp compositing

Questo pacchetto aggiunge la mappa precisa del template 1200×628 e aggiorna la route:

- `app/api/compose-campaign/route.ts`
- `lib/template-layout.ts`

## File richiesti nel progetto

Metti questi file nel progetto reale:

```text
TIM UltraStudio/public/templates/template-01-base.png
TIM UltraStudio/public/fonts/timsans-heavy.ttf
TIM UltraStudio/public/fonts/timsans-bold.ttf
```

Opzionale:

```text
TIM UltraStudio/public/fonts/timsans-regular.ttf
```

## Coordinate usate

- Headline: `x 526`, `y 10.66`, `w 644`, `h 190`
- Price left: `x 526`, `y 272.03`, `w 193`, `h 148`
- Price right: `x 726`, `y 290.96`, `w 143`, `h 46.99`
- Period: `x 726.34`, `y 348.23`, `w 164.48`, `h 52.87`
- CTA: `x 558.19`, `y 466.9`, `w 278`, `h 26`
- Legal: `x 526`, `y 540`, `w 644`, `h 78`
- Person: `x 62.78`, `y 117.6`, `w 438.26`, `h 981.12`

## Dopo la sostituzione

```bash
cd '/Users/francesco.cerisano/Documents/TIM UltraStudio'
rm -rf .next
npm run dev
```
