import { Webhook }      from 'svix';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'yad-cold-email-replies';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  chunk => chunks.push(chunk));
    req.on('end',   ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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

  const rawBody = await getRawBody(req);

  // Verify Svix signature
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const wh = new Webhook(secret);
    try {
      wh.verify(rawBody, {
        'svix-id':        req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature'],
      });
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const { type, data } = JSON.parse(rawBody.toString());

  if (type !== 'email.received' || !data) {
    return res.status(200).json({ received: true });
  }

  const {
    email_id: emailId,
    from:     fromRaw = '',
    to:       toRaw,
    subject:  subject = '',
  } = data;

  // Parse "Name <email>" or plain email
  const fromMatch = fromRaw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const fromName  = fromMatch?.[1]?.trim() ?? '';
  const fromEmail = fromMatch?.[2]?.trim().toLowerCase() ?? fromRaw;

  const toAddr = Array.isArray(toRaw) ? toRaw[0] : (toRaw ?? '');

  // Fetch full body from Resend receiving API
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
    return res.status(500).json({ error: error.message, code: error.code, details: error.details });
  }

  // ntfy push
  const title   = `📩 Antwort: ${subject || '(kein Betreff)'}`;
  const message = fromName
    ? `${fromName} <${fromEmail}>\n${preview}`
    : `${fromEmail}\n${preview}`;

  await ntfy(title, message, 'high');

  return res.status(200).json({ received: true });
}
