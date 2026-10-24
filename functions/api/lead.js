// POST /api/lead: tour requests from the landing page forms -> Cloudflare KV.
import { json, readBody, saveLead } from '../_lib/leads.js';

const FIELDS = ['name', 'phone', 'profession', 'source_form', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Bots fill the hidden "website" field; accept silently and store nothing
  if (data.website) return json({ ok: true });

  const lead = {};
  for (const k of FIELDS) lead[k] = String(data[k] || '').trim().slice(0, 200);
  const digits = lead.phone.replace(/\D/g, '');
  const phoneOk = /^[\d\s().+-]{10,20}$/.test(lead.phone) && digits.length >= 10 && digits.length <= 11;
  if (!lead.name || !phoneOk) return json({ ok: false, error: 'invalid' }, 400);

  lead.source = 'landing-page';
  lead.user_agent = (request.headers.get('user-agent') || '').slice(0, 300);
  await saveLead(env, request, lead);
  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
