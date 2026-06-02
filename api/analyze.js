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
    // Jedes Modul speichert seine Daten sofort in Supabase wenn fertig —
    // damit bericht.html in Echtzeit Insights anzeigen kann
    const save = (update) => supabase.from('analyses').update(update).eq('id', analysis_id).then(() => {});

    const [websiteMd, socialMd, adsMd, { googleMd, competitorsMd }] = await Promise.all([
      analyzeWebsite(analysis.website_url).then(md => { save({ website_md: md }); return md; }),
      analyzeSocial(analysis.instagram_accounts, analysis.city).then(md => { save({ social_md: md }); return md; }),
      analyzeAds(analysis.studio_name, analysis.city, analysis.facebook_page_id).then(md => { save({ ads_md: md }); return md; }),
      fetchGoogleData(analysis.studio_name, analysis.city, analysis.google_url).then(d => {
        save({ google_md: d.googleMd, competitors_md: d.competitorsMd });
        return d;
      }),
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
      max_tokens: 6000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const reportMd       = message.content[0].text;
    const scoreTotal     = parseScore(reportMd, 'Aktuelle Sichtbarkeit');
    const scorePotential = parseScore(reportMd, 'Erreichbares Potenzial');

    const structuredData = extractStructuredData({
      websiteMd, googleMd, socialMd, adsMd, competitorsMd,
      scoreTotal, scorePotential,
    });

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
      structured_data: structuredData,
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

  const rawCompetitors = searchResults.filter(p => !isOwn(p.name)).slice(0, 5);
  const competitors    = await enrichCompetitors(rawCompetitors, apiKey);

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
  const ratings = competitors.map(p => p.user_ratings_total).filter(v => v != null);
  const avgReviews = ratings.length
    ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : '—';

  const rows = competitors.map((p, i) => {
    const adsLabel = !p.adsStatus               ? '—'
      : p.adsStatus.active                      ? 'ja (aktiv)'
      : p.adsStatus.hasHistory                  ? 'nur Archiv'
      :                                           'nein';
    const igLabel = p.igFollowers != null
      ? p.igFollowers.toLocaleString('de-DE') + ' Follower'
      : p.igHandle ? `@${p.igHandle}`
      : '—';
    return `| ${i + 1} | ${p.name} | ${p.user_ratings_total ?? '—'} | ${p.rating ?? '—'} | ${igLabel} | ${adsLabel} |`;
  }).join('\n');

  const ownRow = `| — | **${studioName} ← DU** | **${ownResult?.user_ratings_total ?? '—'}** | **${ownResult?.rating ?? '—'}** | — | siehe Modul 4 |`;

  const adsActive = competitors.filter(c => c.adsStatus?.active).length;

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
Marktführer Instagram:      ${competitors[0]?.igFollowers != null ? competitors[0].igFollowers.toLocaleString('de-DE') + ' Follower' : '—'}
Studios mit aktiven Ads:    ${adsActive} von ${competitors.length}
\`\`\`
`;
}

// ─── Wettbewerber-Anreicherung ────────────────────────────────────────────────

async function enrichCompetitors(competitors, apiKey) {
  return Promise.all(competitors.map(async (comp) => {
    // Website via Place Details
    let website = null;
    if (comp.place_id && apiKey) {
      try {
        const r = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${comp.place_id}&fields=website&key=${apiKey}`,
          { signal: AbortSignal.timeout(8000) }
        );
        const d = await r.json();
        website = d.result?.website ?? null;
      } catch {}
    }

    // Instagram-Handle von Website scrapen + Follower holen + Ads prüfen — parallel
    const [igHandle, adsStatus] = await Promise.all([
      website ? scrapeIgHandle(website) : Promise.resolve(null),
      checkCompetitorAds(comp.name),
    ]);

    const igFollowers = igHandle ? await getIgFollowers(igHandle) : null;

    return { ...comp, website, igHandle, igFollowers, adsStatus };
  }));
}

async function scrapeIgHandle(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YADAnalysis/1.0)' },
      signal:  AbortSignal.timeout(8000),
    });
    const html = await r.text();
    const m = html.match(
      /instagram\.com\/(?!p\/|reel[s]?\/|stories\/|explore\/|tv\/|accounts\/)([a-zA-Z0-9._]{2,30})\/?["'<\s]/
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function getIgFollowers(handle) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://instagram120.p.rapidapi.com/api/instagram/userInfo', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-host': 'instagram120.p.rapidapi.com',
        'x-rapidapi-key':  key,
      },
      body:   JSON.stringify({ username: handle }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const d    = await r.json();
    const user = d?.result?.[0]?.user ?? null;
    return user?.follower_count ?? null;
  } catch {
    return null;
  }
}

async function checkCompetitorAds(name) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const params = new URLSearchParams({
      search_terms:         name,
      ad_reached_countries: JSON.stringify(['DE', 'AT', 'CH']),
      ad_active_status:     'ALL',
      fields:               'id,ad_delivery_stop_time',
      limit:                '5',
      access_token:         token,
    });
    const r = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    if (d.error || !d.data?.length) return { active: false, hasHistory: false };
    const activeAds = d.data.filter(a => !a.ad_delivery_stop_time);
    return { active: activeAds.length > 0, hasHistory: true };
  } catch {
    return null;
  }
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

// ─── Modul 3 — Social Media (RapidAPI instagram120) ──────────────────────────

async function analyzeSocial(instagramAccounts, city) {
  const accounts = Array.isArray(instagramAccounts) ? instagramAccounts : [];
  const data     = await Promise.all(accounts.map(fetchInstagramData));

  const sections = accounts.map((acc, i) => {
    const d     = data[i];
    const label = i === 0 ? 'Studio-Account' : `Künstler ${i}`;
    if (!d) return `## ${label}: @${acc}\n\`\`\`\nKeine Daten verfügbar\n\`\`\``;

    const engRate = d.followers && d.avgLikes != null
      ? ((d.avgLikes + (d.avgComments ?? 0)) / d.followers * 100).toFixed(2) + '%'
      : '—';

    return `## ${label}: @${acc}
\`\`\`
Follower:                   ${d.followers   ?? '—'}
Posts gesamt:               ${d.mediaCount  ?? '—'}
Posting-Frequenz:           ${d.avgDaysBetween != null ? `alle ${d.avgDaysBetween} Tage` : '—'}
Reels-Anteil:               ${d.reelsRatio  != null ? `${d.reelsRatio}%` : '—'}
Ø Engagement-Rate:          ${engRate}
Ø Likes pro Post:           ${d.avgLikes    ?? '—'}
Ø Kommentare pro Post:      ${d.avgComments ?? '—'}
Peak-Postzeiten:            ${d.peakHours   ?? '—'}
\`\`\``;
  }).join('\n\n');

  return `# Modul 3 — Social Media Analyse

${sections || '## Keine Accounts angegeben'}
`;
}

async function fetchInstagramData(handle) {
  const username = handle.replace(/^@/, '');
  const key      = process.env.RAPIDAPI_KEY;
  if (!key) return null;

  const rapid = (endpoint, body) =>
    fetch(`https://instagram120.p.rapidapi.com/api/instagram/${endpoint}`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-host': 'instagram120.p.rapidapi.com',
        'x-rapidapi-key':  key,
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

  const [userRes, postsRes] = await Promise.all([
    rapid('userInfo', { username }),
    rapid('posts',    { username, maxId: '' }),
  ]);

  // instagram120: result[0].user + result.edges[].node
  const user      = userRes?.result?.[0]?.user ?? userRes?.data?.user ?? null;
  const followers = user?.follower_count ?? null;
  const mediaCount= user?.media_count    ?? null;

  const items = (postsRes?.result?.edges ?? []).map(e => e.node ?? e).filter(Boolean);
  if (!followers && !items.length) return null;

  return { followers, mediaCount, ...calcPostMetrics(items, followers) };
}

function calcPostMetrics(items, followers) {
  if (!items?.length) return {};

  const recent = [...items]
    .sort((a, b) => (b.taken_at || 0) - (a.taken_at || 0))
    .slice(0, 12);

  // Posting-Frequenz
  let avgDaysBetween = null;
  if (recent.length >= 2) {
    const span = (recent[0].taken_at - recent[recent.length - 1].taken_at) / 86400;
    avgDaysBetween = Math.round((span / (recent.length - 1)) * 10) / 10;
  }

  // Peak-Uhrzeiten (DE ≈ UTC+1)
  const hourCounts = {};
  for (const p of recent) {
    if (!p.taken_at) continue;
    const h = ((new Date(p.taken_at * 1000).getUTCHours() + 1) % 24);
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([h]) => `${h}:00 Uhr`)
    .join(', ') || '—';

  // Reels-Anteil (media_type 2 = Video/Reel)
  const reelsRatio = Math.round(
    recent.filter(p => p.media_type === 2).length / recent.length * 100
  );

  // Engagement
  const avgLikes    = Math.round(recent.reduce((s, p) => s + (p.like_count    || 0), 0) / recent.length);
  const avgComments = Math.round(recent.reduce((s, p) => s + (p.comment_count || 0), 0) / recent.length);

  return { avgDaysBetween, peakHours, reelsRatio, avgLikes, avgComments };
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
  Nutze die echten Wettbewerber-Zahlen aus Modul 5.
  ≥ 90% des Ø → 90–100 | 70–89% → 70–89 | 50–69% → 50–69
  30–49% → 30–49 | 10–29% → 10–29 | < 10% oder keine → 0–9
  Sterne-Bonus: Ø ≥ 4,8★ → +5 Punkte

Map-Pack-Position für primären Suchbegriff: 25%
  #1 → 100 | #2 → 90 | #3 → 80 | #4–5 → 60–70
  #6–10 → 35–55 | nicht sichtbar → 5

Instagram-Sichtbarkeit: 20%
  Teilscore A (50%): Follower vs. Top-3 aus Modul 5 (echte Wettbewerber-Zahlen verwenden)
    ≥ 80% des Ø → 80–100 | 60–79% → 60–79 | 40–59% → 40–59
    20–39% → 20–39 | < 20% → 5–19 | kein Account → 0
  Teilscore B (30%): Posting-Frequenz (Ø Tage zwischen Posts aus Modul 3)
    ≤ 2,3 Tage → 90–100 | ≤ 3,5 Tage → 70–89 | ≤ 7 Tage → 50–69
    > 7 Tage → 20–49 | kein Post seit > 30 Tagen → 0–19
  Teilscore C (20%): Engagement-Rate (aus Modul 3)
    ≥ 5% → 90–100 | 3–4,9% → 70–89 | 1,5–2,9% → 40–69
    0,5–1,4% → 20–39 | < 0,5% → 0–19 | keine Daten → 30

Website-Qualität: 20%
  Online-Buchung vorhanden → +30 | Meta Pixel → +20
  Adresse + Öffnungszeiten → +20 | CTA-Button → +15
  PageSpeed Mobile ≥ 70 → +10 | Portfolio → +5

Meta Ads aktiv: 10%
  Aktiv seit > 30 Tagen → 80–100 | Aktiv seit < 30 Tagen → 50–79
  Nur Archiv → 20–40 | Keine Ads → 0
  Wettbewerber-Kontext: Nutze "Studios mit aktiven Ads" aus Modul 5 für Einordnung

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
[Analysiere mit den echten Daten aus Modul 3:
- Follower-Position im Vergleich zu den Wettbewerbern aus Modul 5
- Posting-Rhythmus (Ø Tage zwischen Posts) und was das für Reichweite bedeutet
- Reels-Anteil: ob das Studio das stärkste Format nutzt oder vernachlässigt
- Engagement-Rate: was sie über die Qualität der Follower aussagt
- Peak-Postzeiten: ob zu optimalen oder suboptimalen Zeiten gepostet wird
Immer mit Geschäftsauswirkung — Anfragen die gewonnen oder verloren werden]

### Meta Ads
[Analysiere mit den echten Daten aus Modul 4:
- Ob aktiv, seit wie vielen Tagen, wie viele Anzeigen
- Wettbewerber-Kontext: wie viele der lokalen Studios laut Modul 5 aktiv schalten
- Was das Fehlen oder Vorhandensein von Ads konkret bedeutet für Neukundengewinnung]

### Wettbewerber
[Vergleichstabelle exakt aus Modul 5 übernehmen + 2–3 Sätze Einordnung:
- Wer dominiert Google-Reviews und warum das Marktanteile kostet
- Instagram-Vergleich: wo steht das Studio vs. die stärksten Accounts
- Wer schaltet Ads — und was das für den bedeutet der zuerst damit anfängt]

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

// ─── Structured data extractor ───────────────────────────────────────────────

function extractStructuredData({ websiteMd, googleMd, socialMd, adsMd, competitorsMd, scoreTotal, scorePotential }) {
  return {
    // Website
    pagespeed_mobile:       sdInt(websiteMd,  /PageSpeed Score Mobile:\s*(\d+)/),
    has_booking:            sdBool(websiteMd, /Online-Buchungssystem:\s*ja/),
    has_meta_pixel:         sdBool(websiteMd, /Meta Pixel installiert:\s*ja/),
    has_cta:                sdBool(websiteMd, /CTA-Button vorhanden:\s*ja/),
    has_whatsapp:           sdBool(websiteMd, /WhatsApp-Link:\s*ja/),
    has_ga4:                sdBool(websiteMd, /Google Analytics[^:]*:\s*ja/),
    has_portfolio:          sdBool(websiteMd, /Portfolio[^:]*:\s*ja/),
    has_ssl:                sdBool(websiteMd, /SSL \(HTTPS\):\s*ja/),

    // Google
    google_reviews:         sdInt(googleMd,   /Google Reviews Anzahl:\s*(\d+)/),
    google_rating:          sdFloat(googleMd, /Google Reviews Ø[^:]*:\s*([\d.]+)/),
    map_pack_position:      sdText(googleMd,  /Map-Pack Position:\s*([^\n`]+)/),
    has_opening_hours:      sdBool(googleMd,  /Öffnungszeiten eingetragen:\s*ja/),

    // Instagram
    ig_followers:           sdInt(socialMd,   /Follower:\s*(\d+)/),
    ig_media_count:         sdInt(socialMd,   /Posts gesamt:\s*(\d+)/),
    ig_posting_freq_days:   sdFloat(socialMd, /alle ([\d.]+) Tage/),
    ig_reels_ratio:         sdInt(socialMd,   /Reels-Anteil:\s*(\d+)%/),
    ig_engagement_rate:     sdFloat(socialMd, /Engagement-Rate:\s*([\d.]+)%/),
    ig_avg_likes:           sdInt(socialMd,   /Ø Likes pro Post:\s*(\d+)/),
    ig_avg_comments:        sdInt(socialMd,   /Ø Kommentare pro Post:\s*(\d+)/),
    ig_peak_hours:          sdText(socialMd,  /Peak-Postzeiten:\s*([^\n`]+)/),

    // Ads
    ads_active:             sdBool(adsMd,     /Meta Ads aktiv:\s*ja/),
    ads_active_since_days:  sdInt(adsMd,      /Aktiv seit \(Tage\):\s*(\d+)/),
    ads_archived_count:     sdInt(adsMd,      /Archivierte Anzeigen:\s*(\d+)/),
    ads_never_ran:          sdBool(adsMd,     /Letzter Ads-Zeitraum:\s*noch nie/),

    // Competitors
    competitors:            sdCompetitors(competitorsMd),
    market_leader_reviews:  sdInt(competitorsMd, /Marktführer Reviews:\s*(\d+)/),
    market_leader_rating:   sdFloat(competitorsMd, /Marktführer Sterne:\s*([\d.]+)/),
    avg_reviews_top5:       sdInt(competitorsMd, /Ø Google Reviews[^:]*:\s*(\d+)/),
    studios_with_active_ads:sdInt(competitorsMd, /Studios mit aktiven Ads:\s*(\d+)/),

    // Scores
    score_total,
    score_potential,
  };
}

function sdInt(md, re)   { if (!md) return null; const m = md.match(re); return m ? parseInt(m[1]) : null; }
function sdFloat(md, re) { if (!md) return null; const m = md.match(re); return m ? parseFloat(m[1].replace(',', '.')) : null; }
function sdBool(md, re)  { return md ? re.test(md) : null; }
function sdText(md, re)  { if (!md) return null; const m = md.match(re); return m ? m[1].trim() : null; }

function sdCompetitors(md) {
  if (!md) return [];
  return [...md.matchAll(/\|\s*(\d+)\s*\|\s*([^|*\n]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g)]
    .map(r => ({
      rank:           parseInt(r[1]),
      name:           r[2].trim(),
      google_reviews: parseInt(r[3]) || null,
      google_rating:  parseFloat(r[4]) || null,
      ig_followers:   /^\d/.test(r[5].trim()) ? parseInt(r[5].replace(/[^\d]/g, '')) : null,
      ads_active:     r[6].toLowerCase().includes('aktiv'),
    }))
    .filter(c => !c.name.includes('←') && c.name.length > 1);
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
