import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'yad-cold-email-replies';
const REPLY_TO   = 'max@reply.yad.rocks';

export const config = { api: { bodyParser: true } };

async function ntfy(title, message, priority = 'high') {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, message, priority }),
      signal:  AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('ntfy error:', e.message);
  }
}

async function fetchEmailBody(emailId) {
  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      signal:  AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify shared secret (set RESEND_INBOUND_SECRET in Vercel env)
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (secret && req.headers['x-inbound-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, data } = req.body ?? {};

  if (type !== 'email.received' || !data) {
    return res.status(200).json({ received: true });
  }

  const {
    email_id:  emailId,
    from:      fromRaw,
    to:        toRaw,
    subject:   subject = '',
  } = data;

  // Parse from: "Name <email>" or just "email"
  const fromMatch = (fromRaw ?? '').match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const fromName  = fromMatch?.[1]?.trim() ?? '';
  const fromEmail = fromMatch?.[2]?.trim().toLowerCase() ?? fromRaw ?? '';

  const toAddr = Array.isArray(toRaw) ? toRaw[0] : toRaw ?? REPLY_TO;

  // Fetch full body from Resend
  let bodyText = '';
  let bodyHtml = '';
  if (emailId) {
    const full = await fetchEmailBody(emailId);
    bodyText = full?.text ?? '';
    bodyHtml = full?.html ?? '';
  }

  const preview = bodyText.slice(0, 300).replace(/\s+/g, ' ').trim();

  // Store in Supabase
  const { error } = await supabase.from('email_replies').insert({
    resend_email_id: emailId ?? null,
    from_email:      fromEmail,
    from_name:       fromName,
    to_email:        toAddr,
    subject,
    body_text:       bodyText,
    body_html:       bodyHtml,
    reply_label:     '',
  });

  if (error) {
    console.error('Supabase insert error:', error);
  }

  // ntfy notification
  const title   = `📩 Antwort: ${subject || '(kein Betreff)'}`;
  const message = fromName
    ? `${fromName} <${fromEmail}>\n${preview}`
    : `${fromEmail}\n${preview}`;

  await ntfy(title, message, 'high');

  return res.status(200).json({ received: true });
}
