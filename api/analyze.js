import Anthropic       from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 300 };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `Du bist kein Audit-Tool. Du bist kein SEO-Berater. Du bist kein Marketingberater.

Du bist ein erfahrener Unternehmensberater für lokale Unternehmen — mit dem Fokus auf Wachstum, Anfragen und Umsatz.

Deine einzige Aufgabe: die größten Umsatzhebel eines lokalen Unternehmens identifizieren und so erklären, dass der Inhaber sofort versteht, was ihn gerade Geld kostet.

STIMME UND TON
Schreibe wie ein Senior-Berater in einem Erstgespräch.
Direkt. Präzise. Respektvoll, aber ohne Umwege.
Sprich den Inhaber direkt an: "Ihr Studio", "Sie haben", "Ihre Position".
Keine Einleitung. Kein "Im Folgenden". Kein "Vielen Dank".
Kurze Absätze. Maximal 3 Sätze pro Absatz.

ABSOLUTE AUSSAGEN — KEIN HEDGING
Treffe Aussagen. Kein Konjunktiv, wo die Daten eine klare Antwort geben.
Nicht: "Dies könnte darauf hindeuten, dass..." — Sondern: "Das bedeutet: [Konsequenz]."

VERGLEICHE SIND PFLICHT
Jede Kennzahl steht in Relation zu den lokalen Wettbewerbern.
Nicht: "47 Google-Bewertungen." — Sondern: "47 Bewertungen — der Marktführer in Ihrer Stadt hat 312."

UMSATZSPRACHE — KEIN TECH-JARGON
Jeder technische Befund wird in Euro oder Anfragen übersetzt.

OPPORTUNITY — NICHT FEHLER
Menschen kaufen Potenzial, nicht Schuld.

KEINE METHODE IM OUTPUT
Keine Erwähnung von APIs, Scrapers, Zugangsbeschränkungen oder Datenquellen.
Wenn ein Datenpunkt fehlt: nicht erwähnen. Vorhandene Daten genügen für eine starke Analyse.

DATENTREUE UND GENAUIGKEIT
Nutze ausschließlich die bereitgestellten Daten.
Wenn ein Feld "—" enthält: diesen Datenpunkt im Report nicht erwähnen.
Eine falsche Zahl zerstört Vertrauen.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (req.headers['x-analyze-secret'] !== process.env.ANALYZE_SECRET) {
    return res.status(401).end();
  }

  const { analysis_id } = req.body;
  if (!analysis_id) return res.status(400).json({ error: 'No analysis_id' });

  const { data: analysis, error: fetchError } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysis_id)
    .single();

  if (fetchError || !analysis) return res.status(404).end();
  if (!analysis.paid)          return res.status(403).end();

  try {
    const [websiteMd, socialMd, adsMd, { googleMd, competitorsMd }] = await Promise.all([
      analyzeWebsite(analysis.website_url),
      analyzeSocial(analysis.instagram_accounts, analysis.city),
      analyzeAds(analysis.studio_name, analysis.city, analysis.facebook_page_id),
      fetchGoogleData(analysis.studio_name, analysis.city, analysis.google_url),
    ]);

    const userPrompt = buildUserPrompt({
      studioName: analysis.studio_name,
      city:       analysis.city,
      websiteMd,
      googleMd,
      socialMd,
      adsMd,
      competitorsMd,
    });

    const message = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const reportMd       = message.content[0].text;
    const scoreTotal     = parseScore(reportMd, 'Aktuelle Sichtbarkeit');
    const scorePotential = parseScore(reportMd, 'Erreichbares Potenzial');

    await supabase.from('analyses').update({
      status:          'done',
      report_md:       reportMd,
      score_total:     scoreTotal,
      score_potential: scorePotential,
      website_md:      websiteMd,
      google_md:       googleMd,
      social_md:       socialMd,
      ads_md:          adsMd,
      competitors_md:  competitorsMd,
      updated_at:      new Date().toISOString(),
    }).eq('id', analysis_id);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Analysis pipeline failed:', err);
    await supabase.from('analyses').update({
      status:     'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', analysis_id);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Modul 1 — Website ────────────────────────────────────────────────────────

async function analyzeWebsite(url) {
  let html           = '';
  let pagespeedScore = '—';

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YADAnalysis/1.0)' },
      signal:  AbortSignal.timeout(12000),
    });
    html = await r.text();
  } catch {}

  try {
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`,
      { signal: AbortSignal.timeout(20000) }
    );
    const d = await r.json();
    const s = d.lighthouseResult?.categories?.performance?.score;
    if (s != null) pagespeedScore = Math.round(s * 100);
  } catch {}

  const has = (re) => re.test(html);

  return `# Modul 1 — Website-Analyse

## Basisdaten
\`\`\`
URL:                        ${url}
Datum der Analyse:          ${new Date().toISOString().split('T')[0]}
\`\`\`

## Performance
\`\`\`
PageSpeed Score Mobile:     ${pagespeedScore}
\`\`\`

## Conversion-Elemente
\`\`\`
Online-Buchungssystem:      ${has(/booksy\.com|treatwell|calendly|simplybook|fresha/i) ? 'ja' : 'nein'}
CTA-Button vorhanden:       ${has(/termin|buchen|anfrag|book now|jetzt buchen/i) ? 'ja' : 'nein'}
WhatsApp-Link:              ${has(/wa\.me\/|whatsapp\.com/i) ? 'ja' : 'nein'}
Telefonnummer sichtbar:     ${has(/tel:|telefon|\+49|\+43|\+41/i) ? 'ja' : 'nein'}
\`\`\`

## Tracking & Daten
\`\`\`
Meta Pixel installiert:     ${has(/fbq\s*\(|fbevents\.js/) ? 'ja' : 'nein'}
Google Analytics (GA4):     ${has(/gtag\s*\(|G-[A-Z0-9]{6,}/) ? 'ja' : 'nein'}
\`\`\`

## Inhalt & Vertrauen
\`\`\`
Portfolio / Arbeiten:       ${has(/portfolio|galerie|gallery|unsere arbeiten/i) ? 'ja' : 'nein'}
Impressum vorhanden:        ${has(/impressum/i) ? 'ja' : 'nein'}
Social-Media-Links:         ${has(/instagram\.com|facebook\.com|tiktok\.com/i) ? 'ja' : 'nein'}
\`\`\`

## Struktur
\`\`\`
Mobile-Optimierung:         ${has(/viewport/) ? 'ja' : 'nein'}
SSL (HTTPS):                ${url.startsWith('https') ? 'ja' : 'nein'}
\`\`\`
`;
}

// ─── Modul 2 + 5 — Google Places (geteilt) ───────────────────────────────────

async function fetchGoogleData(studioName, city, googleUrl) {
  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) {
    return {
      googleMd:      googleFallback(studioName, city, googleUrl),
      competitorsMd: competitorsFallback(studioName, city),
    };
  }

  // Suche nach "tattoo studio {city}" — liefert Map-Pack-Reihenfolge + Wettbewerber
  let searchResults = [];
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent('tattoo studio ' + city)}&language=de&key=${apiKey}`,
      { signal: AbortSignal.timeout(12000) }
    );
    const d = await r.json();
    searchResults = d.results || [];
  } catch {}

  // Eigenes Studio in den Ergebnissen finden
  const nameLower    = studioName.toLowerCase();
  const isOwn        = (name) => {
    const n = name.toLowerCase();
    return n.includes(nameLower) || nameLower.includes(n);
  };
  const ownIndex  = searchResults.findIndex(p => isOwn(p.name));
  const ownResult = ownIndex >= 0 ? searchResults[ownIndex] : null;

  // Map-Pack-Position bestimmen
  let mapPackPosition;
  if (ownIndex === -1)       mapPackPosition = 'nicht sichtbar';
  else if (ownIndex < 3)     mapPackPosition = `#${ownIndex + 1}`;
  else                       mapPackPosition = `#${ownIndex + 1} (außerhalb Top 3)`;

  // Detaildaten für das eigene Studio (Öffnungszeiten, Adresse)
  let studioDetails = ownResult;
  if (ownResult?.place_id) {
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${ownResult.place_id}` +
        `&fields=name,rating,user_ratings_total,opening_hours,formatted_address,website` +
        `&language=de&key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const d = await r.json();
      if (d.result) studioDetails = { ...ownResult, ...d.result };
    } catch {}
  }

  const competitors = searchResults.filter(p => !isOwn(p.name)).slice(0, 5);

  return {
    googleMd:      buildGoogleMd(studioName, city, googleUrl, studioDetails, mapPackPosition),
    competitorsMd: buildCompetitorsMd(studioName, city, competitors, ownResult),
  };
}

function buildGoogleMd(studioName, city, googleUrl, details, mapPackPosition) {
  const reviews = details?.user_ratings_total ?? '—';
  const rating  = details?.rating             ?? '—';
  const address = details?.formatted_address  ?? '—';
  const hours   = details?.opening_hours      ? 'ja' : 'nein';

  return `# Modul 2 — Google Business Analyse

## Basisdaten
\`\`\`
Business-Name:              ${details?.name || studioName}
Stadt:                      ${city}
Adresse:                    ${address}
Google Business URL:        ${googleUrl || '—'}
\`\`\`

## Bewertungen
\`\`\`
Google Reviews Anzahl:      ${reviews}
Google Reviews Ø (Sterne):  ${rating}
\`\`\`

## Lokale Sichtbarkeit
\`\`\`
Primärer Suchbegriff:       Tattoo Studio ${city}
Map-Pack Position:          ${mapPackPosition}
\`\`\`

## Profil-Vollständigkeit
\`\`\`
Öffnungszeiten eingetragen: ${hours}
Website verlinkt:           ${googleUrl ? 'ja' : 'nein'}
\`\`\`
`;
}

function buildCompetitorsMd(studioName, city, competitors, ownResult) {
  const ratings  = competitors.map(p => p.user_ratings_total).filter(v => v != null);
  const avgReviews = ratings.length
    ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : '—';

  const rows = competitors.map((p, i) =>
    `| ${i + 1} | ${p.name} | ${p.user_ratings_total ?? '—'} | ${p.rating ?? '—'} | — | — |`
  ).join('\n');

  const ownReviews = ownResult?.user_ratings_total ?? '—';
  const ownRating  = ownResult?.rating             ?? '—';
  const ownRow     = `| — | **${studioName} ← DU** | **${ownReviews}** | **${ownRating}** | — | — |`;

  return `# Modul 5 — Wettbewerbsanalyse

## Markt
\`\`\`
Stadt / Region:             ${city}
Primärer Suchbegriff:       "Tattoo Studio ${city}"
Eigenes Studio:             ${studioName}
\`\`\`

## Wettbewerbs-Tabelle

| Rang | Studio | Google Reviews | Google Ø★ | Instagram Follower | Meta Ads |
|---|---|---|---|---|---|
${rows}
${ownRow}

## Markt-Durchschnittswerte
\`\`\`
Ø Google Reviews (Top 5):   ${avgReviews}
Marktführer Reviews:        ${competitors[0]?.user_ratings_total ?? '—'}
Marktführer Sterne:         ${competitors[0]?.rating ?? '—'}
\`\`\`
`;
}

function googleFallback(studioName, city, googleUrl) {
  return `# Modul 2 — Google Business Analyse

## Basisdaten
\`\`\`
Business-Name:              ${studioName}
Stadt:                      ${city}
Google Business URL:        ${googleUrl || '—'}
\`\`\`

## Analyse-Hinweis
\`\`\`
Bewerte die Google-Sichtbarkeit basierend auf typischen Wettbewerbsbedingungen
für Tattoo-Studios in ${city}. Schätze realistisch: Map-Pack-Position,
Review-Anzahl des Marktführers, Review-Durchschnitt.
\`\`\`
`;
}

function competitorsFallback(studioName, city) {
  return `# Modul 5 — Wettbewerbsanalyse

## Markt
\`\`\`
Stadt / Region:             ${city}
Eigenes Studio:             ${studioName}
\`\`\`

## Analyse-Hinweis
\`\`\`
Analysiere die Wettbewerbssituation für Tattoo-Studios in ${city}.
Schätze realistisch: Anzahl Wettbewerber, Review-Zahlen des Marktführers,
Durchschnitt der Top-5. Nutze dein Wissen über den deutschen Tattoo-Markt.
\`\`\`
`;
}

// ─── Modul 3 — Social Media + Instagram-Scraping ─────────────────────────────

async function analyzeSocial(instagramAccounts, city) {
  const accounts = Array.isArray(instagramAccounts) ? instagramAccounts : [];

  // Alle Accounts parallel scrapen
  const scraped = await Promise.all(accounts.map(scrapeInstagram));

  const lines = accounts.map((acc, i) => {
    const data    = scraped[i];
    const label   = i === 0 ? 'Studio-Account    ' : `Künstler ${i}        `;
    const handle  = `@${acc}`;
    const follow  = data?.followers != null ? String(data.followers) : '—';
    const posts   = data?.posts     != null ? String(data.posts)     : '—';
    return `${label}:   ${handle}\nFollower               :   ${follow}\nPosts gesamt           :   ${posts}`;
  }).join('\n\n');

  return `# Modul 3 — Social Media Analyse

## Instagram-Accounts
\`\`\`
${lines || 'Studio-Account:               —'}
\`\`\`

## Analyse-Hinweis
\`\`\`
Bewerte die Instagram-Präsenz dieser Accounts.
Vergleiche mit typischen Top-3 Tattoo-Studios in ${city}.
\`\`\`
`;
}

async function scrapeInstagram(handle) {
  const username = handle.replace(/^@/, '');

  // 1. Interne Instagram API (echte Follower-Zahlen)
  try {
    const r = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'x-ig-app-id':     '936619743392459',
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':          '*/*',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Referer':         'https://www.instagram.com/',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (r.ok) {
      const data = await r.json();
      const user = data?.data?.user;
      if (user) return {
        followers: user.edge_followed_by?.count             ?? null,
        posts:     user.edge_owner_to_timeline_media?.count ?? null,
      };
    }
  } catch {}

  // 2. Fallback: OG-Tag Scraping
  try {
    const r = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_useragent.php)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await r.text();
    const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
              || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1];
    if (desc) {
      const followers = parseIgNumber(desc.match(/([\d.,]+)\s*(Follower[s]?)/i)?.[1]);
      const posts     = parseIgNumber(desc.match(/([\d.,]+)\s*(Post[s]?|Beiträge|Beitrag)/i)?.[1]);
      if (followers != null || posts != null) return { followers, posts };
    }
  } catch {}

  return null;
}

function parseIgNumber(str) {
  if (!str) return null;
  const n = parseInt(str.replace(/[.,]/g, ''), 10);
  return isNaN(n) ? null : n;
}

// ─── Modul 4 — Ads ───────────────────────────────────────────────────────────

async function analyzeAds(studioName, city, facebookPageId) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return adsFallback(studioName, city);

  try {
    // Page-ID gibt präzise Treffer; ohne ID brauchen wir Länderfilter
    const params = facebookPageId
      ? new URLSearchParams({
          search_page_ids:  JSON.stringify([facebookPageId]),
          ad_active_status: 'ALL',
          fields:           'id,ad_delivery_start_time,ad_delivery_stop_time',
          limit:            '25',
          access_token:     token,
        })
      : new URLSearchParams({
          search_terms:         studioName,
          ad_reached_countries: JSON.stringify(['DE', 'AT', 'CH']),
          ad_active_status:     'ALL',
          fields:               'id,ad_delivery_start_time,ad_delivery_stop_time',
          limit:                '25',
          access_token:         token,
        });

    const r = await fetch(
      `https://graph.facebook.com/v19.0/ads_archive?${params}`,
      { signal: AbortSignal.timeout(12000) }
    );
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);

    const ads        = d.data || [];
    const activeAds  = ads.filter(a => !a.ad_delivery_stop_time);
    const archived   = ads.filter(a =>  a.ad_delivery_stop_time);

    // Wie lange laufen die aktiven Ads schon?
    let activeSinceDays = '—';
    if (activeAds.length > 0) {
      const oldest = activeAds.reduce((min, a) =>
        new Date(a.ad_delivery_start_time) < new Date(min.ad_delivery_start_time) ? a : min
      );
      activeSinceDays = Math.round(
        (Date.now() - new Date(oldest.ad_delivery_start_time)) / 86_400_000
      );
    }

    // Wann liefen zuletzt Ads?
    let lastAdDate = '—';
    if (archived.length > 0) {
      const latest = archived.reduce((max, a) =>
        new Date(a.ad_delivery_stop_time) > new Date(max.ad_delivery_stop_time) ? a : max
      );
      lastAdDate = latest.ad_delivery_stop_time.split('T')[0];
    }

    const neverRan = activeAds.length === 0 && archived.length === 0;

    return `# Modul 4 — Werbeanzeigen-Analyse

## Meta Ads (Facebook & Instagram)
\`\`\`
Studio-Name:                ${studioName}
Meta Ads aktiv:             ${activeAds.length > 0 ? 'ja' : 'nein'}
Anzahl aktive Anzeigen:     ${activeAds.length}
Aktiv seit (Tage):          ${activeSinceDays}
Archivierte Anzeigen:       ${archived.length}
Letzter Ads-Zeitraum:       ${neverRan ? 'noch nie' : lastAdDate}
\`\`\`
`;
  } catch (err) {
    console.error('Meta Ads API error:', err.message);
    return adsFallback(studioName, city);
  }
}

function adsFallback(studioName, city) {
  return `# Modul 4 — Werbeanzeigen-Analyse

## Meta Ads
\`\`\`
Studio-Name:                ${studioName}
Stadt:                      ${city}
Meta Ads aktiv:             —
\`\`\`
`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildUserPrompt({ studioName, city, websiteMd, googleMd, socialMd, adsMd, competitorsMd }) {
  return `Analysiere folgende Daten und erstelle einen Wachstumsreport für den Inhaber von ${studioName} in ${city}.

---
WEBSITE-DATEN
${websiteMd}

---
GOOGLE BUSINESS DATEN
${googleMd}

---
SOCIAL MEDIA DATEN
${socialMd}

---
WERBEANZEIGEN-DATEN
${adsMd}

---
WETTBEWERBSDATEN
${competitorsMd}

---

SCORING-METHODE (verwende exakt diese Gewichtung):

Google Reviews vs. Top-5-Durchschnitt: 25%
  ≥ 90% des Ø → 90–100 | 70–89% → 70–89 | 50–69% → 50–69
  30–49% → 30–49 | 10–29% → 10–29 | < 10% oder keine → 0–9
  Sterne-Bonus: Ø ≥ 4,8★ → +5 Punkte

Map-Pack-Position für primären Suchbegriff: 25%
  #1 → 100 | #2 → 90 | #3 → 80 | #4–5 → 60–70
  #6–10 → 35–55 | nicht sichtbar → 5

Instagram-Sichtbarkeit: 20%
  Teilscore A (70%): Follower vs. Top-3-Ø
    ≥ 80% → 80–100 | 60–79% → 60–79 | 40–59% → 40–59
    20–39% → 20–39 | < 20% → 5–19 | kein Account → 0
  Teilscore B (30%): Posting-Frequenz (Ø Tage zwischen Posts)
    ≤ 2,3 Tage → 90–100 | ≤ 3,5 Tage → 70–89 | ≤ 7 Tage → 50–69
    > 7 Tage → 20–49 | kein Post seit > 30 Tagen → 0–19

Website-Qualität: 20%
  Online-Buchung vorhanden → +30 | Meta Pixel → +20
  Adresse + Öffnungszeiten → +20 | CTA-Button → +15
  PageSpeed Mobile ≥ 70 → +10 | Portfolio → +5

Meta Ads aktiv: 10%
  Aktiv seit > 30 Tagen → 80–100 | Aktiv seit < 30 Tagen → 50–79
  Nur Archiv → 20–40 | Keine Ads → 0

---

Erstelle den Report in exakt dieser Struktur:

# ${studioName} — Wachstumsanalyse ${city}

---

## Executive Summary

[5 Sätze — direkt mit dem größten Engpass beginnen. Mindestens eine konkrete Zahl. Kein Konjunktiv.]

---

## Marktposition

[Marktposition in Bezug auf Reviews, Sichtbarkeit, Social, Buchungssystem — nur Zahlenvergleiche]

---

## Die 3 größten Wachstumshebel

### Hebel 1: [Titel]

**Problem:** [Was die Daten zeigen — eine Aussage]
**Beleg:** [Konkrete Zahl + direkter Wettbewerbsvergleich]
**Auswirkung:** [Anfragen oder Euro, die verloren gehen oder gewonnen werden]
**Priorität:** Hoch

### Hebel 2: [Titel]

**Problem:** [Was die Daten zeigen]
**Beleg:** [Konkrete Zahl + Vergleich]
**Auswirkung:** [Anfragen oder Euro]
**Priorität:** Hoch / Mittel

### Hebel 3: [Titel]

**Problem:** [Was die Daten zeigen]
**Beleg:** [Konkrete Zahl + Vergleich]
**Auswirkung:** [Anfragen oder Euro]
**Priorität:** Mittel

---

## Was uns überrascht hat

[Genau ein Befund — nicht offensichtlich, zeigt Tiefe der Analyse. Direkt mit dem Befund beginnen.]

---

## Verlorene Chancen

[Nur Wettbewerbsvergleiche mit Zahlen. Keine Empfehlungen — nur Fakten.]

---

## 90-Tage-Plan

### Maßnahme 1: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

### Maßnahme 2: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

### Maßnahme 3: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

---

## Detailanalyse

### Website
[Befunde — immer mit Geschäftsauswirkung, max. 3 Absätze]

### Google Business
[Befunde — immer mit Geschäftsauswirkung, max. 3 Absätze]

### Instagram
[Befunde — immer mit Geschäftsauswirkung, max. 3 Absätze]

### Meta Ads
[Befunde — immer mit Geschäftsauswirkung, max. 3 Absätze]

### Wettbewerber
[Vergleichstabelle aus den Daten + 1–2 Sätze Einordnung]

---

## Wachstumspotenzial

**Aktuelle Sichtbarkeit: [X]/100**

| Kriterium | Gewichtung | Score |
|---|---|---|
| Google Reviews | 25% | [X]/100 |
| Map-Pack-Sichtbarkeit | 25% | [X]/100 |
| Instagram | 20% | [X]/100 |
| Website | 20% | [X]/100 |
| Meta Ads | 10% | [X]/100 |

**Erreichbares Potenzial in 90 Tagen: [Y]/100**

[2–3 Sätze: Warum ist das Potenzial höher — welche Hebel treiben den Sprung]

---

## Wenn wir einen Bereich zuerst angehen würden

[Ein Absatz — der eine Hebel mit der stärksten Anfragen-Wirkung, basierend auf den Daten. Kein CTA, kein Konjunktiv.]`;
}

// ─── Score parser ─────────────────────────────────────────────────────────────

function parseScore(md, label) {
  const patterns = [
    new RegExp(`\\*\\*${label}[^:]*:\\s*(\\d+)/100`),
    new RegExp(`${label}[^:]*:\\s*(\\d+)/100`),
    new RegExp(`${label}[:\\s]+(\\d+)\\/100`),
  ];
  for (const p of patterns) {
    const m = md.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}
