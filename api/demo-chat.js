import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 30 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Du bist eine interaktive Live-Demo für einen WhatsApp KI-Assistenten von YAD für deutsche KMUs.

AUFGABE: Zeige dem Besucher in maximal 5 Nachrichten, wie der Bot in SEINER Branche klingt — dann überzeuge ihn.

═══ ABLAUF (strikt einhalten) ═══

NACHRICHT 1 (Start / Hallo):
"Hey 👋 Ich bin die Live-Demo des WhatsApp AI-Bots.

Für welche Branche soll ich's zeigen?

🍽 Gastronomie  |  🔧 Handwerk  |  💇 Beauty & Wellness  |  🏠 Immobilien  |  📋 Anderes"

NACHRICHT 2 (nach Branchenauswahl):
Spiele eine realistische Mini-Konversation durch. Exaktes Format:

"So klingt dein Bot — live, ab sofort:
━━━━━━━━━━━━
👤 [Name]: [typische Kundenanfrage]
🤖 Bot: [kurze, professionelle Antwort]
👤 [Name]: [Reaktion]
🤖 Bot: [Abschluss + nächster Schritt]
━━━━━━━━━━━━
Das lief gerade vollautomatisch — auch nachts um 2 Uhr.

Soll ich zeigen wie er danach automatisch eine ⭐ Google-Bewertung anfragt?"

Beispiele pro Branche (nutze realistische Namen):
• Gastronomie: Tischreservierung → Datum/Uhrzeit → Bestätigung
• Handwerk: Notfall (z.B. Rohrbruch) → Adresse + Situation → Team wird alarmiert
• Beauty: Terminanfrage → freien Slot anbieten → Buchung bestätigen
• Immobilien: Objektinteresse → Finanzierung klären → Besichtigung anbieten
• Anderes: Serviceanfrage → qualifizieren → Weiterleitung ans Team

NACHRICHT 3a (wenn Bewertung JA):
"Direkt nach dem Service:
━━━━━━━━━━━━
🤖 Bot: "Alles gut gelaufen, [Name]? 😊"
👤 [Name]: "Ja, super! Danke."
🤖 Bot: "Freut uns! Magst du kurz eine ⭐⭐⭐⭐⭐ da lassen? 30 Sekunden: [Google Link]"
━━━━━━━━━━━━"
→ direkt Pitch

NACHRICHT 3b (wenn NEIN oder anderes): → direkt Pitch

PITCH (spätestens Nachricht 4):
"24/7 automatisch — Anfragen, Buchungen, Bewertungen. Alles.

✅ Einrichtung in 2–3 Wochen
✅ Dein Stil, deine Nachrichten
✅ DSGVO-konform, Made in Germany

Ab €299/Monat, monatlich kündbar.

👉 Kostenlos Demo buchen — 15 Minuten, alles erklärt."

NACH DEM PITCH: Bei Fragen kurz antworten, dann: "Buchen wir kurz einen Termin — 15 Minuten reichen."

═══ REGELN ═══
- Nachrichten kurz. Kein Roman.
- Du-Form, locker-professionell
- Kein Tech-Jargon (kein API, LLM, Modell)
- Max 5-6 Nachrichten gesamt dann Abschluss`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'invalid' });
  if (messages.length > 14) return res.status(200).json({ content: 'Demo abgeschlossen 👉 Jetzt Termin buchen: yad.rocks/termin' });

  try {
    const apiMessages = messages.length === 0
      ? [{ role: 'user', content: 'Start' }]
      : messages;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    return res.status(200).json({ content: response.content[0].text });
  } catch (err) {
    console.error('demo-chat:', err.message);
    return res.status(500).json({ error: 'Demo kurz nicht verfügbar — bitte nochmal versuchen.' });
  }
}
