import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

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
    capiLead({ name, phone, email }),
  ]);

  return res.status(200).json({ ok: true });
}

async function capiLead({ name, phone, email }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  try {
    const sha = s => createHash('sha256').update(s).digest('hex');
    const userData = { fn: [sha(name.split(' ')[0].toLowerCase())] };
    if (email) userData.em = [sha(email.toLowerCase().trim())];
    if (phone) userData.ph = [sha(phone.replace(/[^0-9]/g, ''))];
    await fetch('https://graph.facebook.com/v21.0/27377162821974280/events', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name:       'Lead',
          event_time:       Math.floor(Date.now() / 1000),
          action_source:    'website',
          event_source_url: 'https://yad.rocks/makler-bot',
          user_data:        userData,
          custom_data:      { currency: 'EUR', value: 299, content_name: 'exit_popup_lead' },
          access_token:     token,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('CAPI error:', e.message);
  }
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
        to:      ['maxschwarz727@icloud.com'],
        subject: `Neuer Bot-Lead: ${name}`,
        text:    body,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('Resend error:', e.message);
  }
}
