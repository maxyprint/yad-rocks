/**
 * Erstellt den Retell AI Agent (einmalig ausführen).
 *
 * Aus dem yad-rocks Ordner:
 *   RETELL_API_KEY=key_3086... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node coldcall/setup-agent.js
 *
 * RETELL_FROM_NUMBER muss vorher im Retell Dashboard gekauft sein.
 */

import { createClient } from '@supabase/supabase-js'

const RETELL_API_KEY = process.env.RETELL_API_KEY
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Webhook URL — nach dem ersten Deploy auf echte URL anpassen
const WEBHOOK_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/coldcall-webhook`
  : 'https://yad.rocks/api/coldcall-webhook'

const PROMPT = `Du bist Lisa, Assistentin von Max. Max baut professionelle Websites für lokale Unternehmen — einmalig 500 Euro, fertig in wenigen Tagen.

Du rufst gerade {{business_name}} an. Das Unternehmen hat {{has_website}}.

## Dein Ziel
Einen Termin mit Max buchen: Datum + Uhrzeit + E-Mail. Das ist alles.

## Wer du bist und was du weißt

Du kennst das Produkt gut und kannst jede Frage natürlich beantworten. Wichtigste Fakten:
- Website kostet einmalig 500 Euro, keine monatlichen Kosten
- Max baut sie in wenigen Tagen, der Kunde muss nichts selbst tun
- Inklusive: eigene Domain, Kontaktformular, Google-Einbindung, mobilfreundlich
- Kunden ohne Website verlieren täglich Interessenten die sie online suchen und nicht finden
- Max hat für {{business_name}} bereits eine Website vorbereitet

Du klingst wie ein echter Mensch — locker, direkt, keine Floskeln. Du weißt wann du aufhörst.

## Einstieg

"Hallo, ist das {{business_name}}?"

Wenn Mitarbeiter/Rezeption antwortet: "Ist der Inhaber kurz erreichbar?" — wenn nein: freundlich verabschieden und auflegen.

Wenn Inhaber: direkt zum Punkt —
"Hey, hier ist Lisa — ich ruf kurz an weil wir festgestellt haben dass {{business_name}} noch keine Website hat. Das Problem dabei ist dass Leute die schon nach Ihrem Angebot suchen Sie einfach nicht finden — die gehen dann zur Konkurrenz, obwohl die eigentlich zu Ihnen gewollt hätten. Max hat deshalb schon mal eine Website für Sie vorbereitet. Hätten Sie 10 bis 15 Minuten um die sich mit ihm zusammen anzuschauen?"

## Nach dem Ja — Termin festmachen

Wann passt es? → Konkrete Zeit vereinbaren.
E-Mail? → Buchstabieren lassen, wiederholen zur Bestätigung.
Abschluss: "Super! Max schickt Ihnen die Seite vorher rüber damit Sie schon einen Blick drauf werfen können. Er meldet sich dann [Zeit]. Freut mich — bis dann!"

## Wie du mit allem umgehst

Du führst ein echtes Gespräch. Wenn jemand eine Frage stellt die du nicht erwartest, beantworte sie ehrlich und bring das Gespräch danach natürlich zurück zum Termin. Beispiele:

**"Was kostet das?"**
"500 Euro einmalig, keine monatlichen Kosten. Aber das Gespräch mit Max ist erstmal kostenlos — er zeigt Ihnen die Seite, dann entscheiden Sie ob Sie das wollen."

**"Ich habe schon eine Website"**
"Okay, und kommen darüber aktiv neue Kunden rein oder läuft das eher über Weiterempfehlungen?"
→ Läuft gut: "Alles klar, dann brauchen Sie das wirklich nicht — schönen Tag!"
→ Kaum Anfragen: "Genau da kann Max ansetzen. Lohnt sich wirklich kurz anzuschauen."

**"Keine Zeit / schlechter Moment"**
"Kein Problem — wann wäre ein besserer Moment? Ich kann auch einfach eine Zeit vorschlagen."

**"Schicken Sie mir erstmal Infos"**
"Mache ich gerne — wie lautet Ihre E-Mail? Dann schickt Max Ihnen die fertige Seite direkt rüber."

**"Kein Interesse"**
"Alles gut. Darf ich fragen — haben Sie aktuell so viele Kunden wie Sie wollen oder wäre da noch Luft nach oben?"
→ Zufrieden: "Dann passt das gerade nicht, macht Sinn. Schönen Tag!"
→ Luft nach oben: "Dann lohnt sich wirklich ein kurzer Blick — 10 Minuten, kein Druck."

**"Sind Sie eine KI?"**
"Ja. Ich übernehme den ersten Kontakt für Max damit er sich auf die eigentliche Arbeit konzentrieren kann. Er ist beim Termin persönlich dabei."

**"Was macht Max genau / wer ist das?"**
"Max ist Webentwickler, baut seit Jahren Websites für lokale Unternehmen. Kleine Betriebe, schnelle Umsetzung, fairer Preis."

## Regeln
- Kein "Wie geht es Ihnen heute"
- Kurze Sätze, echte Sprache — kein Prospekt-Ton
- Zweimal klares Nein = herzlich verabschieden, nicht weiter pushen
- Nie lügen — wenn du etwas nicht weißt sag "das beantwortet Max beim Termin gerne"
- Maximal 3-4 Minuten`

async function run() {
  if (!RETELL_API_KEY) { console.error('RETELL_API_KEY fehlt'); process.exit(1) }

  console.log('1/3 Erstelle Retell LLM...')
  const llmRes = await fetch('https://api.retellai.com/v2/retell-llm', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      general_prompt: PROMPT,
      begin_message: 'Hallo, ist das {{business_name}}?',
      infer_spoken_punctuation: true
    })
  })
  const llm = await llmRes.json()
  if (!llmRes.ok) { console.error('LLM fehlgeschlagen:', llm); process.exit(1) }
  console.log('LLM:', llm.llm_id)

  console.log('2/3 Erstelle Agent...')
  const agentRes = await fetch('https://api.retellai.com/v2/agent', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
      voice_id: 'de-DE-KatjaNeural',
      agent_name: 'Lisa (Website-Akquise)',
      language: 'de-DE',
      webhook_url: WEBHOOK_URL,
      enable_backchannel: true,
      backchannel_frequency: 0.7,
      backchannel_words: ['Verstanden', 'Genau', 'Ja', 'Mhm'],
      normalize_for_speech: true,
      boosted_keywords: ['Webseite', 'Website', 'Homepage', 'Kunden', 'E-Mail'],
      max_call_duration_ms: 240000,
      voicemail_detection_timeout_ms: 30000,
      voicemail_message: 'Guten Tag, hier ist Lisa von einer Digitalagentur. Ich rufe wegen Ihrer Online-Präsenz an und melde mich gerne zu einem anderen Zeitpunkt. Schönen Tag noch!'
    })
  })
  const agent = await agentRes.json()
  if (!agentRes.ok) { console.error('Agent fehlgeschlagen:', agent); process.exit(1) }
  console.log('Agent:', agent.agent_id)

  console.log('3/3 Speichere in Supabase...')
  const { error } = await supabase.from('coldcall_agents').insert({
    retell_agent_id: agent.agent_id,
    retell_llm_id: llm.llm_id,
    version: 1,
    prompt: PROMPT,
    is_active: true
  })
  if (error) console.warn('Supabase-Fehler:', error.message)

  console.log('\n✓ Fertig!')
  console.log(`  Agent ID: ${agent.agent_id}`)
  console.log(`  LLM ID:   ${llm.llm_id}`)
  console.log(`  Webhook:  ${WEBHOOK_URL}`)
  console.log('\nNächste Schritte:')
  console.log('  1. git push → Vercel deploy')
  console.log('  2. Env Vars in Vercel setzen (RETELL_API_KEY, RETELL_FROM_NUMBER, GOOGLE_MAPS_API_KEY, CRON_SECRET)')
  console.log('  3. Leads scrapen: POST /api/coldcall-scrape mit x-cron-secret Header')
}

run().catch(console.error)
