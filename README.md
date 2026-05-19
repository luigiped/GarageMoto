# 🏍️ GarageMoto

> Il tuo cruscotto digitale per ogni moto — traccia consumi, percorsi e manutenzione in un'unica app.

## ✨ Funzionalità

### 🏠 Dashboard
- KPI in tempo reale: ultimo km/l, media consumi, autonomia stimata, spesa mensile
- Alert manutenzioni scadute o in scadenza
- Card ultimo rifornimento e ultimo viaggio
- Accesso rapido alle statistiche complete

  <img width="672" height="1496" alt="WhatsApp Image 2026-05-19 at 13 53 31" src="https://github.com/user-attachments/assets/2cf9adb4-1abf-49a2-a96d-39fdfa7c16b6" />


### 🏍️ Garage
- Gestione multi-veicolo con foto reale della moto
- Profilo tecnico completo (marca, modello, anno, cilindrata, serbatoio, carburante)
- Foto personalizzabile da galleria o fotocamera

### ⛽ Carburante
- Inserimento rifornimenti con calcolo automatico km/l
- Prezzo/litro calcolato in tempo reale durante l'inserimento
- Indicatore visivo del consumo rispetto alla media (verde/arancio)
- Filtri storico: Tutto / 1 mese / 3 mesi / 1 anno
- Export CSV

<img width="672" height="1496" alt="WhatsApp Image 2026-05-19 at 13 54 14" src="https://github.com/user-attachments/assets/fae9267b-5775-468f-a58a-9e7f2e839657" />

### 🗺️ Viaggi GPS
- Registrazione percorso con tracciamento GPS live
- Mappa con polilinea del percorso in tempo reale
- Statistiche live: distanza, velocità, massima raggiunta
- Schermo sempre acceso durante la registrazione
- Dettaglio viaggio con mappa del percorso completo
- Scarto automatico viaggi troppo brevi (< 500m o < 1 min)

  <img width="919" height="2048" alt="WhatsApp Image 2026-05-19 at 19 13 46" src="https://github.com/user-attachments/assets/8dc0d4c6-220f-4d16-a506-f14c8f36eeea" />


### 📊 Statistiche
- Grafico lineare km/l nel tempo (solo pieni completi)
- Grafico a barre spesa mensile (ultimi 6 mesi)
- Grafico a barre km percorsi per mese
- Grafico andamento prezzo carburante €/L
- Selector periodo: 1M / 3M / 6M / 1A / Tutto
- Riepilogo periodo: spesa, litri, km, media km/l

### 🔧 Manutenzione
- 10 tipi predefiniti + tipo personalizzato
- Alert per km e per data (warning entro 500km/30gg, overdue oltre)
- Notifiche locali automatiche quando una scadenza entra in warning
- Progress bar visiva avanzamento verso la scadenza

### ⚙️ Impostazioni
- Export dati CSV (rifornimenti + viaggi)
- Info versione e stato runtime
- Gestione account e disconnessione


## 🛠️ Stack Tecnologico

| Layer | Tecnologia |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 54 + React Native 0.76 |
| Linguaggio | TypeScript (strict) |
| Navigazione | [Expo Router](https://expo.github.io/router) 4 (file-based) |
| UI | React Native StyleSheet + Design system centralizzato |
| State | [Zustand](https://zustand-demo.pmnd.rs) 4 |
| Database locale | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (offline-first) |
| Backend | [Supabase](https://supabase.com) (da attivare in produzione) |
| Mappe | [react-native-maps](https://github.com/react-native-maps/react-native-maps) |
| Grafici | [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts) |
| GPS | [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) + foreground service |
| Notifiche | [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) |
| Build | [EAS Build](https://docs.expo.dev/build/introduction/) (cloud) |

<br/>

## 🎨 Design System

L'app usa un sistema di design centralizzato in `src/theme.ts` con due preset selezionabili:

- **`rally`** — tema scuro con accenti primari vibranti
- **`glass`** — glassmorphism con effetti blur e trasparenze

Il token `brandFantic: '#e4052c'` è riservato esclusivamente al nome brand Fantic.  
Il colore primario attivo è **Cobalto Premium** `#5E5CE6`.


## 📁 Struttura del progetto

```
garagemoto/
├── app/                          # Expo Router — ogni file è una route
│   ├── _layout.tsx               # Root layout + init DB + auth listener
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── index.tsx             # Dashboard
│       ├── garage.tsx            # Garage + foto moto
│       ├── refuels.tsx           # Carburante
│       ├── trips.tsx             # Viaggi GPS
│       ├── statistics.tsx        # Statistiche e grafici
│       ├── maintenance.tsx       # Manutenzione
│       └── settings.tsx          # Impostazioni
│
├── src/
│   ├── theme.ts                  # Design system (unico punto colori/spacing)
│   ├── components/               # Componenti riutilizzabili
│   │   ├── GlassBackground.tsx
│   │   ├── GlassCard.tsx
│   │   ├── GlassStatRow.tsx
│   │   └── FuelRangeButton.tsx
│   ├── store/                    # Zustand stores
│   │   ├── authStore.ts
│   │   ├── vehicleStore.ts
│   │   ├── refuelStore.ts
│   │   ├── maintenanceStore.ts
│   │   └── tripStore.ts
│   ├── db/                       # SQLite locale
│   │   ├── client.ts
│   │   └── schema.ts
│   ├── services/                 # Servizi nativi
│   │   ├── supabase.ts
│   │   ├── notifications.ts
│   │   └── location.ts
│   ├── utils/                    # Business logic pura
│   │   ├── fuelCalculator.ts
│   │   ├── maintenanceChecker.ts
│   │   ├── statisticsCalculator.ts
│   │   ├── csvExporter.ts
│   │   └── formatters.ts
│   └── types/                    # TypeScript types
│       ├── vehicle.ts
│       ├── refuel.ts
│       ├── maintenance.ts
│       └── trip.ts
│
├── __tests__/                    # Test unitari
│   ├── fuelCalculator.test.ts
│   ├── maintenanceChecker.test.ts
│   └── statisticsCalculator.test.ts
│
├── assets/                       # Immagini e icone
├── .env.example                  # Template variabili d'ambiente
├── app.json
├── eas.json
├── babel.config.js
└── tsconfig.json
```

## 🚀 Avvio del progetto

### Prerequisiti

- [Node.js](https://nodejs.org) 20 LTS
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Account [Expo](https://expo.dev) (gratuito) per EAS Build

### 1. Clona il repository

```bash
git clone https://github.com/luigiped/GarageMoto
cd garagemoto
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

```bash
cp .env.example .env.local
```

Apri `.env.local` e inserisci le credenziali Supabase (opzionale — l'app funziona offline senza):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Avvia in development

```bash
npx expo start
```

Scansiona il QR con **Expo Go** per test rapido (senza GPS background e notifiche).

### 5. Build APK per device fisico

```bash
# Login EAS (solo la prima volta)
npx eas-cli login

# Build APK installabile direttamente
eas build -p android --profile preview
```

Al termine del build (10-15 min) ricevi un link per scaricare e installare l'APK.


## 🧪 Test

```bash
# Esegui tutti i test unitari
npm test

# TypeScript check
npx tsc --noEmit
```

I test coprono la business logic critica:
- `fuelCalculator` — calcoli km/l, autonomia, spesa mensile
- `maintenanceChecker` — logica alert warning/overdue per km e data
- `statisticsCalculator` — aggregazioni mensili, serie temporali

<br/>

## 🗄️ Database

L'app è **offline-first**: tutti i dati vengono scritti prima su SQLite locale, poi sincronizzati con Supabase in background.

```
Scrittura → SQLite locale (immediato) → Supabase (background)
Lettura   → sempre da SQLite
```

### Attivare Supabase (produzione)

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Esegui lo schema SQL dal file `CLAUDE.md` sezione **Schema SQL**
3. Copia le credenziali in `.env.local`
4. Esegui un nuovo build EAS


## 📄 Documentazione tecnica

- [`CLAUDE.md`](./CLAUDE.md) — Architettura, stack, schema DB, convenzioni di codice
- [`RELEASE_1.1.md`](./RELEASE_1.1.md) — Specifiche GPS + Statistiche
- [`RELEASE_1.2.md`](./RELEASE_1.2.md) — Specifiche Import CSV + Bluetooth
- [`RELEASE_1.3.md`](./RELEASE_1.3.md) — Specifiche OCR + PDF + Performance

## ⚙️ Variabili d'ambiente

| Variabile | Descrizione | Obbligatoria |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del progetto Supabase | No (solo produzione) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chiave anonima Supabase | No (solo produzione) |

> ⚠️ Non committare mai `.env.local` — è già in `.gitignore`.


## 🔒 Privacy

- Tutti i dati sono salvati **localmente sul dispositivo**
- Nessun dato viene inviato a server esterni finché Supabase non è configurato
- Le foto della moto sono salvate nel filesystem locale del dispositivo
- Il GPS è usato **solo durante la registrazione attiva** di un viaggio

## 📝 Licenza

Progetto ad uso personale — non destinato alla pubblicazione sugli store.

---

<p align="center">
  Sviluppato con ❤️ per i motociclisti
</p>
