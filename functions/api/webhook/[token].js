// POST /api/webhook/<WEBHOOK_TOKEN>: inbound leads from Encore's main website (Gravity Forms now, GHL later).
// Accepts JSON or form posts in any field layout; normalizes name/phone/email/profession and keeps the raw payload.
import { json, readBody, normalize, saveLead, tokenOk } from '../../_lib/leads.js';

export async function onRequestPost({ request, env, params, waitUntil }) {
  if (!tokenOk(params.token, env.WEBHOOK_TOKEN)) return json({ ok: false, error: 'not_found' }, 404);
  let raw;
  try { raw = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  const n = normalize(raw);
  if (!n.name && !n.phone && !n.email) return json({ ok: false, error: 'no_contact_fields' }, 422);
  const raw_text = JSON.stringify(raw);
  await saveLead(env, request, {
    name: n.name, phone: n.phone, email: n.email, profession: n.profession, message: n.message,
    source: 'main-site', source_form: 'encoresalonsuites.com midtown form',
    raw: raw_text.length > 8000 ? raw_text.slice(0, 8000) + '…' : raw,
  }, waitUntil);
  return json({ ok: true });
}

export function onRequest({ params, env }) {
  if (!tokenOk(params.token, env.WEBHOOK_TOKEN)) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, info: 'POST lead data (JSON or form fields) to this URL.' });
}
