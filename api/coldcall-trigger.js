import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // Vercel Cron schickt Authorization: Bearer {CRON_SECRET}
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!isBusinessHours()) {
    return res.json({ skipped: true, reason: 'Outside business hours' })
  }

  // Max 2 gleichzeitige Calls
  const { count: activeCount } = await supabase
    .from('coldcall_calls')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ongoing')

  if (activeCount >= 2) {
    return res.json({ skipped: true, reason: 'Max concurrent calls reached' })
  }

  const { data: agent } = await supabase
    .from('coldcall_agents')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!agent) {
    return res.status(500).json({ error: 'Kein aktiver Agent — setup-agent.js ausführen' })
  }

  // Leads ohne Website priorisieren (besserer Pitch)
  const { data: lead } = await supabase
    .from('coldcall_leads')
    .select('*')
    .eq('status', 'pending')
    .order('website', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!lead) {
    return res.json({ skipped: true, reason: 'Keine ausstehenden Leads' })
  }

  const phone = formatGermanPhone(lead.phone)
  if (!phone) {
    await supabase.from('coldcall_leads').update({ status: 'invalid' }).eq('id', lead.id)
    return res.json({ skipped: true, reason: `Ungültige Nummer: ${lead.phone}` })
  }

  // Als "calling" markieren um Race Conditions zu vermeiden
  await supabase
    .from('coldcall_leads')
    .update({ status: 'calling', last_called_at: new Date().toISOString() })
    .eq('id', lead.id)

  const callRes = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from_number: process.env.RETELL_FROM_NUMBER,
      to_number: phone,
      agent_id: agent.retell_agent_id,
      metadata: { lead_id: lead.id, business_name: lead.business_name },
      retell_llm_dynamic_variables: {
        business_name: lead.business_name,
        has_website: lead.website
          ? `eine Webseite (${lead.website})`
          : 'noch keine Webseite'
      }
    })
  })

  const callData = await callRes.json()

  if (!callRes.ok) {
    await supabase.from('coldcall_leads').update({ status: 'pending' }).eq('id', lead.id)
    return res.status(500).json({ error: 'Retell-Fehler', details: callData })
  }

  await supabase.from('coldcall_calls').insert({
    lead_id: lead.id,
    retell_call_id: callData.call_id,
    status: 'registered'
  })

  res.json({
    success: true,
    call_id: callData.call_id,
    lead: lead.business_name,
    phone: phone.slice(0, -4) + 'XXXX'
  })
}

function isBusinessHours() {
  const berlin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  const day = berlin.getDay()
  const hour = berlin.getHours()
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18
}

function formatGermanPhone(phone) {
  if (!phone) return null
  let c = phone.replace(/[\s\-().]/g, '')
  if (c.startsWith('00')) c = '+' + c.slice(2)
  else if (c.startsWith('0')) c = '+49' + c.slice(1)
  else if (!c.startsWith('+')) c = '+49' + c
  if (c.length < 12 || c.length > 16) return null
  return c
}
