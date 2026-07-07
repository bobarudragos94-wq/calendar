# Când ne vedem? 🗓️

PWA pentru a găsi rapid **intervalele libere comune** ale unui grup de prieteni.

Tu (organizatorul) creezi un event, stabilești **perioada**, **fereastra orară zilnică** și
**durata meeting-ului**, apoi primești un **cod de join**. Fiecare prieten intră cu codul, își
pune numele și își marchează timpul liber pe o grilă (stil When2meet, sloturi de 30 min).
Aplicația calculează și afișează intervalele în care **sunteți toți liberi în același timp**,
evidențiindu-le pe cele care încap în durata meeting-ului.

## Stack

- **Next.js 14** (App Router, TypeScript) — PWA cu manifest + service worker
- **Tailwind CSS**
- **Turso** (libSQL) prin `@libsql/client`
- Deploy pe **Vercel**

## Configurare locală

```bash
npm install
cp .env.example .env.local   # completează TURSO_DATABASE_URL și TURSO_AUTH_TOKEN
npm run dev
```

Pentru dezvoltare fără cont Turso poți folosi un fișier local:

```
TURSO_DATABASE_URL=file:local.db
```

Schema bazei de date se creează automat la primul request (`CREATE TABLE IF NOT EXISTS`),
deci nu ai nevoie de migrări manuale.

## Deploy pe Vercel

1. Împinge repo-ul pe GitHub și importă-l în Vercel.
2. Adaugă variabilele de mediu în **Project Settings → Environment Variables**:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Deploy. Rutele API rulează pe runtime Node.js (serverless).

### Creare bază Turso

```bash
turso db create cand-ne-vedem
turso db show cand-ne-vedem --url          # -> TURSO_DATABASE_URL
turso db tokens create cand-ne-vedem       # -> TURSO_AUTH_TOKEN
```

## Cum funcționează

1. **Creezi event** (`/`) → primești codul (ex. `K7P2QX`) și un link de share.
2. **Dai codul** prietenilor. Ei intră pe `/e/COD`, își pun numele și marchează sloturile libere.
3. **Rezultate** — heatmap-ul arată câți sunt liberi la fiecare slot; lista de jos arată
   intervalele comune, cu ✓ pe cele ≥ durata meeting-ului. Click pe o celulă din heatmap arată
   exact cine e liber și cine e ocupat în acel slot.

## Structură

```
src/
  app/
    page.tsx                       # home: creare event + join cu cod
    e/[code]/                      # pagina event (grilă + rezultate)
    api/events/                    # rute REST (creare, join, availability, results)
  lib/
    db.ts                          # client Turso + ensureSchema
    slots.ts                       # matematica grilei (partajată client/server)
    results.ts                     # calcul suprapuneri
    queries.ts, types.ts
public/
  manifest.webmanifest, sw.js, icon*.svg
```
