import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { studioName, websiteUrl, city, email, phone, googleUrl, instagramAccounts, facebookPageId, facebookPageName, promoCode } = req.body;

  if (!studioName || !websiteUrl || !city || !email || !instagramAccounts?.length) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }

  const VALID_PROMO = process.env.AUDIT_PROMO_CODE || 'FREEANALYSIS';
  const isFree = promoCode && promoCode.toUpperCase() === VALID_PROMO.toUpperCase();

  const { data: analysis, error: dbError } = await supabase
    .from('analyses')
    .insert({
      studio_name:         studioName,
      website_url:         websiteUrl,
      city,
      email,
      phone:               phone              || null,
      google_url:          googleUrl          || null,
      instagram_accounts:  instagramAccounts,
      facebook_page_id:    facebookPageId     || null,
      facebook_page_name:  facebookPageName   || null,
      status:              'pending',
      paid:                isFree,
      promo_code:          promoCode          || null,
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    await ntfy('❌ Selbstcheck: DB-Fehler', `${studioName} — ${dbError.message}`, 'urgent');
    return res.status(500).json({ error: 'Datenbankfehler.' });
  }

  // Gratis-Pfad: Analyse direkt triggern, kein Stripe
  if (isFree) {
    await ntfy('🎯 Gratis Audit', `${studioName} · ${city} · ${phone || email} — via Promo`);
    fetch('https://yad.rocks/api/analyze', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-analyze-secret': process.env.ANALYZE_SECRET,
      },
      body: JSON.stringify({ analysis_id: analysis.id }),
    }).catch(() => {});
    return res.status(200).json({ berichtUrl: `https://yad.rocks/bericht?id=${analysis.id}` });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode:                 'payment',
    customer_email:       email,
    line_items: [{
      price_data: {
        currency:     'eur',
        unit_amount:  2000,
        product_data: {
          name:        'Tattoo Studio Selbstcheck',
          description: `KI-Wachstumsanalyse für ${studioName}`,
        },
      },
      quantity: 1,
    }],
    metadata:    { analysis_id: analysis.id },
    success_url: `https://yad.rocks/bericht?id=${analysis.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `https://yad.rocks/selbstcheck`,
    locale:      'de',
  });

  await ntfy('💳 Neuer Selbstcheck', `${studioName} · ${city} · ${phone || email} — Checkout gestartet`);
  return res.status(200).json({ checkoutUrl: session.url });
}

async function ntfy(title, message, priority = 'default') {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': priority === 'urgent' ? 'warning,rotating_light' : 'white_check_mark',
      },
      body: message,
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}
