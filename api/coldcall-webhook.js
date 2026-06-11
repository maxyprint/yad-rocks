import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { event, call } = req.body
  if (!call?.call_id) return res.status(400).json({ error: 'No call_id' })

  if (event === 'call_started') {
    await supabase
      .from('coldcall_calls')
      .update({ status: 'ongoing' })
      .eq('retell_call_id', call.call_id)
  }

  if (event === 'call_ended') {
    const transcript = call.transcript || ''
    const outcome = detectOutcome(transcript, call)
    const duration = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : null

    const { data: callRecord } = await supabase
      .from('coldcall_calls')
      .update({
        status: 'ended',
        outcome,
        transcript,
        transcript_object: call.transcript_object || null,
        duration_seconds: duration
      })
      .eq('retell_call_id', call.call_id)
      .select('lead_id')
      .single()

    if (callRecord?.lead_id) {
      const leadStatus =
        outcome === 'interested' ? 'interested' :
        outcome === 'callback_requested' ? 'callback' :
        'called'

      // call_count via raw SQL erhöhen
      await supabase.rpc('coldcall_increment_lead', { p_lead_id: callRecord.lead_id, p_status: leadStatus })
        .catch(async () => {
          // Fallback falls RPC nicht existiert
          await supabase
            .from('coldcall_leads')
            .update({ status: leadStatus, last_called_at: new Date().toISOString() })
            .eq('id', callRecord.lead_id)
        })
    }

    // Alle 20 Calls → Analyse anstoßen
    const { count } = await supabase
      .from('coldcall_calls')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ended')

    if (count && count % 20 === 0) {
      const base = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
      if (base) {
        fetch(`https://${base}/api/coldcall-analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET
          }
        }).catch(() => {})
      }
    }
  }

  res.json({ received: true })
}

function detectOutcome(transcript, call) {
  if (call.disconnection_reason === 'voicemail_reached') return 'voicemail'
  if (call.disconnection_reason === 'call_transfer') return 'callback_requested'

  const t = transcript.toLowerCase()

  if (t.includes('gerne') || t.includes('interessiert') || t.includes('schicken sie') ||
      t.includes('e-mail') || t.includes('klingt gut') || t.includes('machen wir')) {
    return 'interested'
  }
  if (t.includes('zurückrufen') || t.includes('rückruf') || t.includes('später anrufen') ||
      t.includes('anderes mal')) {
    return 'callback_requested'
  }
  if (t.includes('kein interesse') || t.includes('nicht interessiert') ||
      t.includes('brauchen wir nicht') || t.includes('haben wir schon')) {
    return 'not_interested'
  }
  if (t.includes('mailbox') || t.includes('hinterlassen sie')) return 'voicemail'
  if (transcript.length < 80) return 'no_answer'
  return 'completed'
}
