import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC   = 'yad-rocks-appointments';
const FROM_EMAIL   = 'max@yprint.de';
const RESEND_KEY   = process.env.RESEND_API_KEY;

// 45-min slots 09:00–18:00, all end by 18:45
const SLOTS = [];
for (let m = 9 * 60; m + 45 <= 19 * 60; m += 45) {
  SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

const ALLOWED_DAYS = new Set([1, 5, 6]); // Mon, Fri, Sat

function parseLocalDate(str) {
  const [y, mo, d] = str.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

function isAllowedDate(dateStr) {
  const d     = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // today itself is NOT bookable (d > today, not >=)
  return ALLOWED_DAYS.has(d.getDay()) && d > today;
}

function fmtDate(str) {
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

function fmtDateLong(str) {
  const DAYS   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const [y, mo, d] = str.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return `${DAYS[date.getDay()]}, ${d}. ${MONTHS[mo - 1]} ${y}`;
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/book?date=YYYY-MM-DD ──────────────────────────────────────────
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

  // ── POST /api/book ──────────────────────────────────────────────────────────
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
        phone:   phone?.trim()    || null,
        message: message?.trim()  || null,
        source:  source           || 'website',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505')
        return res.status(409).json({ error: 'Termin wurde soeben vergeben. Bitte wähle einen anderen.' });
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Buchung fehlgeschlagen.' });
    }

    const endTime = minToTime(
      slot_time.split(':').reduce((h, m, i) => i === 0 ? +m * 60 : h + +m, 0) + 45
    );
    const dateLong = fmtDateLong(date);

    // Await both before returning — Vercel kills lambda after res.json()
    await Promise.all([
      ntfy(`📅 Neuer Termin — ${name}`,
        `${dateLong} · ${slot_time}–${endTime} Uhr · ${email}${phone ? ' · ' + phone : ''}${message ? '\n"' + message + '"' : ''}`),
      sendConfirmation({ name, email, date, slot_time, endTime, dateLong }),
    ]);

    return res.json({ id: booking.id, date, slot_time, name });
  }

  return res.status(405).end();
}

async function ntfy(title, body) {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method:  'POST',
      headers: { Title: title, Tags: 'calendar,white_check_mark', Priority: 'high' },
      body,
      signal:  AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('ntfy error:', e.message);
  }
}

async function sendConfirmation({ name, email, date, slot_time, endTime, dateLong }) {
  if (!RESEND_KEY) return;
  const firstName = name.split(' ')[0];
  const body = `Hi ${firstName},

dein Termin bei yad.rocks ist bestätigt!

Datum:  ${dateLong}
Zeit:   ${slot_time} – ${endTime} Uhr (45 Minuten)
Format: Video-Call — ich schicke dir kurz vorher den Link

Bei Fragen oder falls du absagen musst: max@yad.rocks

LG Max
yad.rocks`;

  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `Max Schwarz <${FROM_EMAIL}>`,
        to:      [email],
        subject: `Termin bestätigt: ${dateLong}, ${slot_time} Uhr`,
        text:    body,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('Resend error:', e.message);
  }
}
