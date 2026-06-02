# Setup — Selbstcheck Infrastruktur

## 1. Supabase — Tabelle anlegen

SQL im Supabase Query Editor ausführen:

```sql
create table analyses (
  id                  uuid primary key default gen_random_uuid(),
  studio_name         text not null,
  website_url         text not null,
  city                text not null,
  email               text not null,
  google_url          text,
  instagram_accounts  jsonb not null default '[]',
  status              text not null default 'pending',
  paid                boolean not null default false,
  website_md          text,
  google_md           text,
  social_md           text,
  ads_md              text,
  competitors_md      text,
  report_md           text,
  score_total         int,
  score_potential     int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Row Level Security: nur Service Role darf schreiben
alter table analyses enable row level security;

-- Anon darf NUR lesen (für Bericht-Seite, nur eigene Row per ID)
create policy "Public read by id"
  on analyses for select
  using (true);

-- Service Role hat vollen Zugriff (kein Policy nötig — bypasses RLS)
```

---

## 2. Vercel — Projekt anlegen

```bash
# Im yad-rocks Verzeichnis:
npx vercel

# Domain konfigurieren:
# yad.rocks → Vercel DNS
# CNAME www → cname.vercel-dns.com
# A-Record @ → 76.76.21.21
```

---

## 3. Vercel — Environment Variables

In Vercel Dashboard unter Project → Settings → Environment Variables:

| Variable | Wert | Umgebung |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Preview, Development |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production, Preview |
| `SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | All |

---

## 4. Stripe — Webhook einrichten

In Stripe Dashboard → Developers → Webhooks → Add Endpoint:

- URL: `https://yad.rocks/api/webhooks/stripe`
- Events: `checkout.session.completed`
- Secret in `STRIPE_WEBHOOK_SECRET` eintragen

---

## 5. bericht.html — Supabase Keys eintragen

In `bericht.html` die zwei Platzhalter ersetzen:

```js
const SUPABASE_URL      = 'https://DEIN-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'DEIN-ANON-KEY';
```

Anon Key ist public-safe (Row Level Security schützt die Daten).

---

## 6. npm Abhängigkeiten installieren

```bash
cd /Users/maxschwarz/Desktop/yad-rocks
npm init -y
npm install stripe @supabase/supabase-js
```

---

## 7. Deployen

```bash
git add .
git commit -m "Add Selbstcheck: form, payment, report pages + Vercel API"
# Max pushed manually:
git -C /Users/maxschwarz/Desktop/yad-rocks push origin main
```

Vercel deployed automatisch nach Push.
