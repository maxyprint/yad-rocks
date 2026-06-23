import Stripe          from 'stripe';
import { Webhook }      from 'svix';
import { createClient } from '@supabase/supabase-js';
import { waitUntil }    from '@vercel/functions';

export const config = { api: { bodyParser: false }, maxDuration: 30 };

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  chunk => chunks.push(chunk));
    req.on('end',   ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function ntfy(topic, title, message, priority = 'high') {
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, message, priority }),
      signal:  AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('ntfy error:', e.message);
  }
}

// ── Stripe ─────────────────────────────────────────────────────────────────
async function handleStripe(req, res, rawBody) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object;
    const analysisId = session.metadata?.analysis_id;
    const amountEur  = ((session.amount_total ?? 0) / 100).toFixed(0);
    const customer   = session.customer_details?.email ?? session.customer_email ?? 'Unbekannt';

    if (!analysisId) {
      const productName = session.metadata?.product_name ?? 'Paket';
      await ntfy('yad-cold-email-buy', `💰 Neuer Kauf: ${amountEur}€`, `${productName} · ${customer}`, 'urgent');
      return res.status(200).json({ received: true });
    }

    await ntfy('yad-rocks-selbstcheck', `💳 Selbstcheck bezahlt: ${amountEur}€`, `${customer} — Analyse startet`, 'high');

    const { error } = await supabase
      .from('analyses')
      .update({ paid: true, status: 'processing' })
      .eq('id', analysisId);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).end();
    }

    waitUntil(
      fetch('https://yad.rocks/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-analyze-secret': process.env.ANALYZE_SECRET },
        body:    JSON.stringify({ analysis_id: analysisId }),
      }).then(r => {
        if (!r.ok) console.error(`Analyze trigger failed: ${r.status}`);
        else       console.log(`Analysis started for ${analysisId}`);
      })
    );
  }

  return res.status(200).json({ received: true });
}

// ── Email inbound (Resend/Svix) ────────────────────────────────────────────
async function handleEmailInbound(req, res, rawBody) {
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
      console.error('Svix signature failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const { type, data } = JSON.parse(rawBody.toString());
  if (type !== 'email.received' || !data) return res.status(200).json({ received: true });

  const { email_id: emailId, from: fromRaw = '', to: toRaw, subject = '' } = data;

  let fromName  = '';
  let fromEmail = fromRaw.trim().toLowerCase();
  const angleMatch = fromRaw.match(/<([^>]+)>/);
  if (angleMatch) {
    fromEmail = angleMatch[1].trim().toLowerCase();
    fromName  = fromRaw.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '');
  }

  const toAddr = Array.isArray(toRaw) ? toRaw[0] : (toRaw ?? '');

  let bodyText = '', bodyHtml = '';
  if (emailId) {
    try {
      const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        signal:  AbortSignal.timeout(10000),
      });
      if (resp.ok) { const full = await resp.json(); bodyText = full?.text ?? ''; bodyHtml = full?.html ?? ''; }
    } catch {}
  }

  const preview  = bodyText.slice(0, 300).replace(/\s+/g, ' ').trim();
  const bodyLower = bodyText.toLowerCase();
  const HOSTILE   = ['beschwerde', 'belästigung', 'rechtlich', 'anwalt', 'strafanzeige', 'unterlassen', 'abmahnung'];
  const UNSUB     = ['kein interesse', 'keine emails', 'bitte keine', 'austragen', 'abmelden', 'unsubscribe', 'nicht mehr kontaktieren', 'hören sie auf', 'hör auf', 'keine werbung', 'bitte entfernen'];
  let autoLabel = '';
  if (HOSTILE.some(k => bodyLower.includes(k))) autoLabel = 'negative_hostile';
  else if (UNSUB.some(k => bodyLower.includes(k))) autoLabel = 'unsubscribe';

  const { error } = await supabase.from('email_replies').insert({
    resend_email_id: emailId ?? null,
    from_email:      fromEmail,
    from_name:       fromName,
    to_email:        toAddr,
    subject,
    body_text:       bodyText,
    body_html:       bodyHtml,
    reply_label:     autoLabel,
  });
  if (error) console.error('Supabase insert error:', error);

  const title   = `📩 Antwort: ${subject || '(kein Betreff)'}`;
  const message = fromName ? `${fromName} <${fromEmail}>\n${preview}` : `${fromEmail}\n${preview}`;
  await ntfy('yad-cold-email-replies', title, message, 'high');

  return res.status(200).json({ received: true });
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const type    = req.query.type;

  if (type === 'stripe')        return handleStripe(req, res, rawBody);
  if (type === 'email-inbound') return handleEmailInbound(req, res, rawBody);

  // Auto-detect: Stripe sends stripe-signature header
  if (req.headers['stripe-signature']) return handleStripe(req, res, rawBody);
  return handleEmailInbound(req, res, rawBody);
}
