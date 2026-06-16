# TIMMY v2 — Step 01

Questo pacchetto contiene il primo scaffold UI/UX della nuova versione di TIMMY.

## Cosa contiene

- Nuova app Next.js
- Tailwind configurato
- Prima schermata Campaign Adaptation Tool
- Sidebar con i 4 step del flusso
- Schermata centrale dedicata alla creazione del soggetto
- Placeholder upload asset
- Character controls statici

## Cosa NON contiene ancora

- API OpenAI
- Upload reale
- Generazione immagine
- Generazione copy
- Login
- Shadcn installato

Questo step serve solo a fissare la direzione UX/UI.

## Come usarlo

1. Crea una nuova cartella progetto, per esempio `timmy-v2`.
2. Copia dentro tutti i file e le cartelle di questo pacchetto.
3. Apri il terminale nella cartella.
4. Esegui:

```bash
npm install
npm run dev
```

5. Apri l'indirizzo mostrato dal terminale, di solito `http://localhost:3000`.

## Nota per Francesco

Non devi mischiare questi file alla vecchia app Streamlit.
Questo è un nuovo progetto frontend pensato per Vercel.
