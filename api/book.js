import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 45-min slots, 09:00–18:00, all end by 18:45 (within 09:00–19:00 window)
const SLOTS = [];
for (let m = 9 * 60; m + 45 <= 19 * 60; m += 45) {
  SLOTS.push(
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  );
}

const ALLOWED_DAYS = new Set([1, 5, 6]); // Mon, Fri, Sat

function parseLocalDate(str) {
  const [y, mo, d] = str.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

function isAllowedDate(dateStr) {
  const d = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return ALLOWED_DAYS.has(d.getDay()) && d >= today;
}

function fmtDate(str) {
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/book?date=YYYY-MM-DD ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'Ungültiges Datum.' });

    const { data, error } = await supabase
      .from('bookings')
      .select('slot_time')
      .eq('date', date)
      .neq('status', 'cancelled');

    if (error) return res.status(500).json({ error: error.message });

    const booked = new Set((data || []).map(b => b.slot_time));
    return res.json({
      date,
      slots: SLOTS.map(t => ({ time: t, available: !booked.has(t) })),
    });
  }

  // ── POST /api/book ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { date, slot_time, name, email, phone, message, source } = req.body || {};

    if (!date || !slot_time || !name || !email)
      return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'Ungültiges Datum.' });
    if (!isAllowedDate(date))
      return res.status(400).json({ error: 'Dieser Tag ist nicht buchbar.' });
    if (!SLOTS.includes(slot_time))
      return res.status(400).json({ error: 'Ungültige Uhrzeit.' });

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        date,
        slot_time,
        name:    name.trim(),
        email:   email.trim().toLowerCase(),
        phone:   phone?.trim() || null,
        message: message?.trim() || null,
        source:  source || 'website',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505')
        return res.status(409).json({ error: 'Termin wurde soeben vergeben. Bitte wähle einen anderen.' });
      console.error(insertError);
      return res.status(500).json({ error: 'Buchung fehlgeschlagen.' });
    }

    await ntfy(
      '📅 Neuer Termin',
      `${name} · ${fmtDate(date)} ${slot_time} · ${email}${phone ? ' · ' + phone : ''}`
    );

    return res.json({ id: booking.id, date, slot_time, name });
  }

  return res.status(405).end();
}

async function ntfy(title, body) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: title, Tags: 'calendar' },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}
