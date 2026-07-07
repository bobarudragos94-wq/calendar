#!/usr/bin/env bash
#
# Setup bază de date Turso pentru „Când ne vedem?".
# Creează baza și afișează variabilele de mediu gata de copiat.
#
# Utilizare:
#   bash scripts/setup-db.sh [nume-baza]
#
# Necesită Turso CLI. Instalare (o singură dată):
#   curl -sSfL https://get.tur.so/install.sh | bash
#   turso auth login
#
set -euo pipefail

DB_NAME="${1:-cand-ne-vedem}"

if ! command -v turso >/dev/null 2>&1; then
  echo "❌ Turso CLI nu e instalat. Rulează:"
  echo "   curl -sSfL https://get.tur.so/install.sh | bash"
  echo "   turso auth login"
  exit 1
fi

# Creează baza dacă nu există deja.
if turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "ℹ️  Baza '$DB_NAME' există deja — o refolosesc."
else
  echo "📦 Creez baza '$DB_NAME'..."
  turso db create "$DB_NAME"
fi

# (Opțional) aplică schema explicit. Aplicația o creează oricum automat
# la primul request, deci pasul ăsta e doar dacă vrei tabelele de la început.
if [ -f "$(dirname "$0")/../db/schema.sql" ]; then
  echo "🧱 Aplic schema (db/schema.sql)..."
  turso db shell "$DB_NAME" < "$(dirname "$0")/../db/schema.sql"
fi

URL="$(turso db show "$DB_NAME" --url)"
TOKEN="$(turso db tokens create "$DB_NAME")"

echo ""
echo "✅ Gata. Pune astea în Vercel (Environment Variables) sau în .env.local:"
echo "────────────────────────────────────────────────────────────"
echo "TURSO_DATABASE_URL=$URL"
echo "TURSO_AUTH_TOKEN=$TOKEN"
echo "────────────────────────────────────────────────────────────"
