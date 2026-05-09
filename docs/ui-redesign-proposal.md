# GarageMoto UI Redesign Proposal

## Stato attuale
- La UI e coerente ma molto funzionale: quasi tutte le schermate condividono lo stesso schema `titolo + card scure + CTA arancione`.
- Il design system attuale in [src/theme.ts](/Users/luigipedace/Desktop/progetti_app/App_moto/garagemoto/src/theme.ts:1) usa una base dark neutra con arancione racing, ma non costruisce ancora una vera identita visiva.
- La dashboard in [app/(tabs)/index.tsx](/Users/luigipedace/Desktop/progetti_app/App_moto/garagemoto/app/(tabs)/index.tsx:1) e leggibile, ma i KPI hanno la stessa importanza gerarchica e non guidano l’occhio.
- `Garage`, `Carburante`, `Manutenzione` e `Impostazioni` usano pattern molto simili; questo aiuta la coerenza, ma rende l’app poco memorabile.
- Manca una separazione chiara fra aree:
  - dati rapidi
  - azioni principali
  - stato della moto
  - storico

## Problemi visuali principali
- Il linguaggio e piatto: molte card hanno stesso sfondo, stesso raggio, stessa densita.
- La tab bar e funzionale ma non “firma” il brand.
- La moto non e ancora il centro visivo dell’esperienza.
- Gli stati `warning / overdue / ok` esistono, ma non hanno abbastanza forza semantica.
- `Settings` e molto carica e merita una struttura piu editoriale.

## Direzione proposta
Tema consigliato: **Instrument Panel / Rally Roadbook**

Idea:
- mantenere l’anima dark
- usare l’arancione come colore meccanico e non solo come CTA
- introdurre pannelli con feeling da quadro strumenti
- dare piu importanza a numeri, autonomia, stato manutenzione e viaggio

## Principi visuali
- Dashboard come cruscotto, non come semplice lista.
- Card con ruoli diversi: hero, metric, alert, log.
- Tipografia numerica piu forte per km, km/l, autonomia, costi.
- Texture e profondita leggere, senza ombre pesanti.
- Più contrasto tra superfici: sfondo, pannello, modulo, stato.

## Palette proposta
- `bg`: `#0B0D12`
- `panel`: `#131722`
- `panelRaised`: `#1A2030`
- `line`: `#283044`
- `accent`: `#F26A21`
- `accentSoft`: `#FFB37C`
- `info`: `#5BC0EB`
- `ok`: `#4CD964`
- `warn`: `#FFB020`
- `danger`: `#FF5C5C`
- `text`: `#F4F7FB`
- `muted`: `#91A0B8`

## Tipografia proposta
- Headline: piu compatta e forte
- Numeri KPI: stile quasi “dashboard”, grande e monospaced
- Label tecniche: uppercase piccole, tracking largo

## Layout da applicare in una seconda fase
1. `Dashboard`
   Hero superiore con moto attiva, autonomia e stato generale.
2. `Garage`
   Card veicolo piu fotografica e meno solo testuale.
3. `Carburante`
   Form come modulo officina, storico come timeline tecnica.
4. `Viaggi`
   Più focus su mappa e stato tracking.
5. `Manutenzione`
   Stati visivi piu netti con bande colore e priorita.
6. `Impostazioni`
   Sezioni piu compatte con gruppi e pannelli secondari.

## File visuale allegato
- [ui-redesign-concept.html](/Users/luigipedace/Desktop/progetti_app/App_moto/garagemoto/docs/ui-redesign-concept.html)

## Vincoli
- Nessuna modifica al codice runtime e stata fatta in questa fase.
- Questo documento serve solo per approvazione direzione visiva.
