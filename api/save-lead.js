import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'yad-rocks-leads';
const RESEND_KEY = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, email, source, system_prompt, conversation } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name und Telefonnummer sind Pflicht.' });
  }

  const { error } = await supabase.from('bot_leads').insert({
    name:          name.trim(),
    phone:         phone.trim(),
    email:         email?.trim().toLowerCase() || null,
    source:        source || 'bot_onboarding',
    system_prompt: system_prompt || null,
    conversation:  conversation  || null,
  });

  if (error) {
    console.error('Supabase bot_leads error:', error);
    return res.status(500).json({ error: 'Speichern fehlgeschlagen.' });
  }

  await Promise.all([
    ntfy(name, phone, source, conversation),
    notifyEmail(name, phone, email, system_prompt, conversation, source),
  ]);

  return res.status(200).json({ ok: true });
}

async function ntfy(name, phone, source, conversation) {
  try {
    let body = `${phone}${source ? ' · ' + source : ''}`;
    if (conversation) body += `\n\n${conversation}`;
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        Title: `Neuer Bot-Lead: ${name}`,
        Tags: 'robot,phone',
        Priority: 'high',
      },
      body,
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    console.error('ntfy error:', e.message);
  }
}

async function notifyEmail(name, phone, email, system_prompt, conversation, source) {
  if (!RESEND_KEY) return;
  try {
    let body = `Name: ${name}\nTelefon: ${phone}\nEmail: ${email || '–'}\nQuelle: ${source || '–'}`;
    if (conversation) body += `\n\nNachricht:\n${conversation}`;
    if (system_prompt) body += `\n\nSystem-Prompt:\n${system_prompt}`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'YAD Bot <max@yprint.de>',
        to:      ['max@yad.rocks'],
        subject: `Neuer Bot-Lead: ${name}`,
        text:    body,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('Resend error:', e.message);
  }
}
