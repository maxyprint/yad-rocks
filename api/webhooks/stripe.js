import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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
    const session     = event.data.object;
    const analysisId  = session.metadata?.analysis_id;

    if (!analysisId) {
      console.error('No analysis_id in session metadata');
      return res.status(400).end();
    }

    // Mark as paid and trigger processing
    const { error } = await supabase
      .from('analyses')
      .update({ paid: true, status: 'processing' })
      .eq('id', analysisId);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).end();
    }

    // TODO: Trigger analysis pipeline (Inngest event or direct call)
    // await triggerAnalysis(analysisId);

    console.log(`Analysis ${analysisId} marked as processing.`);
  }

  return res.status(200).json({ received: true });
}
