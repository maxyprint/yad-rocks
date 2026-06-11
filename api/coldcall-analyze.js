import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 120 }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const anthropic = new Anthropic()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: calls } = await supabase
    .from('coldcall_calls')
    .select('*, coldcall_leads(business_name, city, category, website)')
    .eq('status', 'ended')
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!calls || calls.length < 5) {
    return res.json({ skipped: true, reason: `Nur ${calls?.length || 0} Calls — min. 5 nötig` })
  }

  const outcomes = calls.reduce((acc, c) => {
    const k = c.outcome || 'unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  const interested = outcomes['interested'] || 0
  const conversionRate = `${interested}/${calls.length} (${Math.round(interested / calls.length * 100)}%)`

  const callSummaries = calls.map((c, i) => {
    const hasWebsite = c.coldcall_leads?.website ? 'hat Webseite' : 'keine Webseite'
    return `### Call ${i + 1} — ${c.coldcall_leads?.business_name || '?'} (${hasWebsite}) | Outcome: ${c.outcome}
Dauer: ${c.duration_seconds || '?'}s
${(c.transcript || '').slice(0, 600)}${(c.transcript?.length || 0) > 600 ? '...' : ''}`
  }).join('\n\n---\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `Du bist Experte für telefonische Kaltakquise in Deutschland. Analysiere diese ${calls.length} Calls für einen Website-Verkauf an lokale KMUs.

**Conversion Rate: ${conversionRate}**
**Outcomes:** ${JSON.stringify(outcomes)}

Identifiziere:
1. **Abbruchpunkte:** Wo brechen Gespräche am häufigsten ab?
2. **Top-Einwände:** Welche Einwände kommen am häufigsten?
3. **Was funktioniert:** Formulierungen die zu Interesse geführt haben
4. **Konkrete Verbesserungen:** 3-5 spezifische Skript-Änderungen

Gib am Ende nur die Skript-Teile aus, die du ändern würdest.

---

${callSummaries}`
    }]
  })

  const analysis = message.content[0].text

  // Analyse an der neuesten Call-Row speichern
  await supabase
    .from('coldcall_calls')
    .update({ analysis_notes: `[Analyse ${new Date().toISOString().slice(0, 10)}]\n${analysis}` })
    .eq('id', calls[0].id)

  res.json({
    success: true,
    calls_analyzed: calls.length,
    conversion_rate: conversionRate,
    outcomes,
    analysis
  })
}
