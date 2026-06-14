import Stripe          from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { waitUntil }    from '@vercel/functions';

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC_PACKAGES   = 'yad-cold-email-buy';
const NTFY_TOPIC_SELBSTCHECK = 'yad-rocks-selbstcheck';

export const config = { api: { bodyParser: false } };

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig     = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object;
    const analysisId = session.metadata?.analysis_id;
    const amountEur  = ((session.amount_total ?? 0) / 100).toFixed(0);
    const customer   = session.customer_details?.email ?? session.customer_email ?? 'Unbekannt';

    if (!analysisId) {
      // Paket-Kauf (coaches.html, handwerk.html, etc.) — kein Selbstcheck
      const productName = session.metadata?.product_name ?? 'Paket';
      await ntfy(
        NTFY_TOPIC_PACKAGES,
        `💰 Neuer Kauf: ${amountEur}€`,
        `${productName} · ${customer}`,
        'urgent'
      );
      return res.status(200).json({ received: true });
    }

    // Selbstcheck-Zahlung
    await ntfy(
      NTFY_TOPIC_SELBSTCHECK,
      `💳 Selbstcheck bezahlt: ${amountEur}€`,
      `${customer} — Analyse startet`,
      'high'
    );

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
        headers: {
          'Content-Type':      'application/json',
          'x-analyze-secret':  process.env.ANALYZE_SECRET,
        },
        body: JSON.stringify({ analysis_id: analysisId }),
      }).then(r => {
        if (!r.ok) console.error(`Analyze trigger failed: ${r.status}`);
        else       console.log(`Analysis started for ${analysisId}`);
      })
    );
  }

  return res.status(200).json({ received: true });
}
