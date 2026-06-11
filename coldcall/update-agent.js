/**
 * Übernimmt ein verbessertes Skript nach der analyze-calls Analyse.
 *
 * NEUE_VERSION="<verbessertes Skript>" \
 * RETELL_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 * node coldcall/update-agent.js
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const RETELL_API_KEY = process.env.RETELL_API_KEY

async function run() {
  const newPrompt = process.env.NEUE_VERSION
  if (!newPrompt) {
    console.error('Kein Skript angegeben. Nutze: NEUE_VERSION="..." node coldcall/update-agent.js')
    process.exit(1)
  }

  const { data: agent } = await supabase
    .from('coldcall_agents')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!agent) { console.error('Kein aktiver Agent'); process.exit(1) }

  const res = await fetch(`https://api.retellai.com/v2/retell-llm/${agent.retell_llm_id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ general_prompt: newPrompt })
  })

  if (!res.ok) { console.error('Update fehlgeschlagen:', await res.json()); process.exit(1) }

  // Versionierung in Supabase
  await supabase.from('coldcall_agents').update({ is_active: false }).eq('id', agent.id)
  await supabase.from('coldcall_agents').insert({
    retell_agent_id: agent.retell_agent_id,
    retell_llm_id: agent.retell_llm_id,
    version: agent.version + 1,
    prompt: newPrompt,
    is_active: true
  })

  console.log(`✓ Agent auf Version ${agent.version + 1} aktualisiert`)
}

run().catch(console.error)
