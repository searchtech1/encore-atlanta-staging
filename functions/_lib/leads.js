// Shared helpers for Encore West Midtown lead storage (KV binding: LEADS).

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra },
  });
}

export async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return await request.json();
  if (type.includes('form')) return Object.fromEntries(await request.formData());
  const text = await request.text();
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}

// Flatten nested payloads (GHL / Gravity Forms webhooks nest fields) into "a.b" keys.
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  }
  return out;
}

function pick(flat, patterns) {
  for (const re of patterns) {
    for (const [k, v] of Object.entries(flat)) if (re.test(k) && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function normalize(raw) {
  const flat = flatten(raw);
  let name = pick(flat, [/(^|\.)(full_?name|name|contact_?name)$/i, /name \(full\)/i]);
  if (!name) {
    const first = pick(flat, [/first.?name/i, /name \(first\)/i]);
    const last = pick(flat, [/last.?name/i, /name \(last\)/i]);
    name = [first, last].filter(Boolean).join(' ');
  }
  return {
    name: name.slice(0, 200),
    phone: pick(flat, [/phone|mobile|cell/i]).slice(0, 40),
    email: pick(flat, [/e-?mail/i]).slice(0, 200),
    profession: pick(flat, [/profession|type.?of.?business|business.?type|service|specialt/i]).slice(0, 200),
    message: pick(flat, [/message|comment|notes?$/i]).slice(0, 2000),
    flat,
  };
}

const SITE = 'https://midtown.encoresalonsuites.com';

// Escape Discord markdown so visitor input shows literally (mentions are blocked via allowed_mentions)
const clean = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max).replace(/([\\`*_~|>#\[\]()])/g, '\\$1') || '—';

export async function notifyDiscord(env, lead) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  const fromAd = lead.fbclid ? 'Meta / Instagram ad' : lead.gclid ? 'Google ad' : (lead.utm_source || '');
  const fields = [
    { name: 'Name', value: clean(lead.name), inline: true },
    { name: 'Phone', value: clean(lead.phone, 40), inline: true },
    { name: 'Profession', value: clean(lead.profession), inline: true },
    { name: 'Came from', value: lead.source === 'main-site' ? 'Main website form' : 'Landing page', inline: true },
  ];
  if (fromAd) fields.push({ name: 'Ad source', value: clean(fromAd), inline: true });
  if (lead.email) fields.push({ name: 'Email', value: clean(lead.email), inline: true });
  if (lead.message) fields.push({ name: 'Message', value: clean(lead.message, 900), inline: false });
  const body = {
    username: 'Encore lead alerts',
    allowed_mentions: { parse: [] },
    content: 'New West Midtown tour request. Call them back now.',
    embeds: [{
      title: 'Tour request · Encore West Midtown',
      color: 0x8E2C3E,
      fields,
      footer: { text: new Date(lead.received_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET' },
      ...(env.LEADS_VIEW_TOKEN ? { url: `${SITE}/leads/${env.LEADS_VIEW_TOKEN}` } : {}),
    }],
  };
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { /* alert failures never block lead capture */ }
}

export async function saveLead(env, request, lead, waitUntil) {
  lead.received_at = new Date().toISOString();
  lead.country = (request.cf && request.cf.country) || '';
  lead.city = (request.cf && request.cf.city) || '';
  const key = `lead:${lead.received_at}:${crypto.randomUUID().slice(0, 8)}`;
  await env.LEADS.put(key, JSON.stringify(lead), {
    metadata: { name: lead.name, phone: lead.phone, source: lead.source },
  });
  const alert = notifyDiscord(env, lead);
  if (waitUntil) waitUntil(alert); else await alert;
  return key;
}

// Constant-time-ish token comparison
export function tokenOk(given, expected) {
  if (!expected || !given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
