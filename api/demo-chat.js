import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 30 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── MAKLER ───────────────────────────────────────────────────────────────────
// Der Bot SPIELT den WhatsApp-Assistenten eines Maklers.
// Der Besucher tippt als Kaufinteressent. Der Bot antwortet als Assistent.
const PROMPTS = {

  makler: `Du bist der WhatsApp-Assistent eines deutschen Immobilienmaklers — du führst gerade ein echtes Erstgespräch mit einem Kaufinteressenten.

DEINE ROLLE: Du bist der Bot. Du antwortest immer nur mit EINER kurzen WhatsApp-Nachricht auf die letzte Nachricht des Interessenten.

DEIN ZIEL: Den Interessenten in maximal 4 Schritten qualifizieren:
1. Kauf oder Miete?
2. Budget?
3. Finanzierung vorhanden?
4. Besichtigungstermin vorschlagen

KONTEXT: Der Interessent hat gerade eine Immobilienanzeige gesehen und schreibt erstmalig an.

STIL:
- Kurz. Max 2 Sätze pro Nachricht.
- Locker aber professionell. Deutsch. Du-Form.
- Immer mit einer konkreten Frage enden — treibe das Gespräch voran.
- Keine Floskeln. Keine Einleitungen.
- Emojis sparsam einsetzen (max 1 pro Nachricht).

NACH DEM 4. QUALIFIZIERUNGSSCHRITT:
Schlage einen konkreten Besichtigungstermin vor (z.B. "Donnerstag 16 Uhr oder Samstag 11 Uhr — was passt?") und schreibe darunter genau diesen Text als neue Zeile:

---PITCH---

BEIM PITCH zeigst du aus der Rolle und sagst:
"Das war dein Bot — vollautomatisch, 24/7.

Budget ✓  Finanzierung ✓  Termin ✓ — ohne dass du eine Sekunde investiert hast.

€499/Monat, Setup in 2–3 Wochen, monatlich kündbar.

👉 15-Min-Gespräch buchen: yad.rocks/termin"

WENN ---PITCH--- schon gesendet wurde: Beantworte kurze Fragen in 1 Satz, leite dann immer zum Termin weiter.

ERSTNACHRICHT (nur wenn history leer ist):
"Hey! 👋 Ich bin der WhatsApp-Assistent — schreib mir einfach wie ein echter Kaufinteressent. Zum Beispiel: *\"Hallo, ich hab eure Wohnung in München gesehen\"*"`,

  default: `Du bist der WhatsApp-Assistent eines deutschen KMU — du führst gerade ein echtes Erstgespräch mit einem Kunden.

ABLAUF IN 2 PHASEN:

PHASE 1 — BRANCHE WÄHLEN:
Wenn noch keine Branche bekannt ist, frage einmalig:
"Hey! 👋 Ich bin dein zukünftiger WhatsApp-Assistent.

Für welche Branche soll ich die Demo zeigen?
🍽 Gastronomie  |  🔧 Handwerk  |  💇 Beauty  |  🏠 Immobilien  |  📋 Anderes"

PHASE 2 — LIVE-GESPRÄCH:
Sobald die Branche bekannt ist: WERDE der Bot für diese Branche.
Sag dem Besucher welche Rolle er spielen soll, z.B.:
"Super — schreib mir jetzt wie ein Kunde der einen Termin buchen will. Los!"

Dann antworte auf jede Nachricht des Besuchers als echter Bot:
- Nur EINE kurze WhatsApp-Nachricht (max 2 Sätze)
- Immer mit einer konkreten Frage enden
- Treibe das Gespräch voran: Termin, Anliegen, Kontaktdaten

NACH 3-4 AUSTAUSCHEN: Steige aus der Rolle aus und zeige den Pitch:
"Das war dein Bot — vollautomatisch, 24/7.

✅ Setup in 2–3 Wochen
✅ Dein Stil, deine Nachrichten
✅ DSGVO-konform

Ab €299/Monat, monatlich kündbar.

👉 Demo buchen: yad.rocks/termin"

STIL: Kurz. Locker. Deutsch. Du-Form. Max 2 Sätze pro Bot-Nachricht. Emojis sparsam.`,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, niche = 'default' } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'invalid' });
  if (messages.length > 16) return res.status(200).json({ content: '👉 Termin buchen: yad.rocks/termin' });

  const systemPrompt = PROMPTS[niche] || PROMPTS.default;

  try {
    const apiMessages = messages.length === 0
      ? [{ role: 'user', content: 'Start' }]
      : messages;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;

    // Split pitch from bot message if marker present
    if (text.includes('---PITCH---')) {
      const [botMsg, pitchMsg] = text.split('---PITCH---').map(s => s.trim());
      return res.status(200).json({ content: botMsg, followUp: pitchMsg || null });
    }

    return res.status(200).json({ content: text });
  } catch (err) {
    console.error('demo-chat:', err.message);
    return res.status(500).json({ error: 'Demo kurz nicht verfügbar.' });
  }
}
