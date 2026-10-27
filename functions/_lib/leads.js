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

const escHtml = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Email each lead to Encore via Resend. Off until RESEND_API_KEY is set.
// LEAD_EMAIL_TO: comma-separated recipients. LEAD_EMAIL_FROM: sender (default encoresalonsuites@sesmgt.com on SES's verified domain).
// To send from Encore's own address instead: verify encoresalonsuites.com in THEIR Resend account, then set
// RESEND_API_KEY to their key and LEAD_EMAIL_FROM to e.g. "Encore Salon Suites <leasingteam@encoresalonsuites.com>". No code change needed.
export async function notifyEmail(env, lead) {
  const to = String(env.LEAD_EMAIL_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!env.RESEND_API_KEY || !to.length) return;
  const fromAd = lead.fbclid ? 'Meta / Instagram ad' : lead.gclid ? 'Google ad' : (lead.utm_source || '');
  const when = new Date(lead.received_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
  const rows = [
    ['Name', lead.name], ['Phone', lead.phone], ['Email', lead.email], ['Profession', lead.profession],
    ['Came from', lead.source === 'main-site' ? 'Main website form' : 'West Midtown landing page'],
    ['Ad source', fromAd], ['Message', lead.message], ['Received', when],
  ].filter(([, v]) => v);
  const tel = String(lead.phone || '').replace(/[^\d+]/g, '');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2A201D;line-height:1.5">
<p style="margin:0 0 6px"><strong>New tour request for Encore West Midtown.</strong></p>
<p style="margin:0 0 16px;color:#6E5D57">Call them back as soon as you can. The faster the call, the more likely the tour.</p>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:15px">${rows.map(([k, v]) =>
  `<tr><td style="color:#6E5D57;border-bottom:1px solid #F1E2DD">${k}</td><td style="border-bottom:1px solid #F1E2DD"><strong>${
    k === 'Phone' && tel ? `<a href="tel:${escHtml(tel)}" style="color:#8E2C3E">${escHtml(v)}</a>`
    : k === 'Email' ? `<a href="mailto:${escHtml(v)}" style="color:#8E2C3E">${escHtml(v)}</a>` : escHtml(v)}</strong></td></tr>`).join('')}</table>
<p style="margin:18px 0 0;font-size:13px;color:#8C7B75">Sent automatically from the <a href="${SITE}" style="color:#8E2C3E">West Midtown landing page</a> by SES Management.</p></div>`;
  const text = 'New tour request for Encore West Midtown.\n\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const body = {
    from: env.LEAD_EMAIL_FROM || 'Encore Salon Suites West Midtown <encoresalonsuites@sesmgt.com>',
    to,
    subject: `New tour request: ${String(lead.name || 'West Midtown lead').slice(0, 60)}${lead.profession ? ' (' + String(lead.profession).slice(0, 30) + ')' : ''}`,
    html, text,
    ...(lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? { reply_to: lead.email } : {}),
  };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) console.log('lead email failed', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.log('lead email error', String(e)); }
}

export async function saveLead(env, request, lead, waitUntil) {
  lead.received_at = new Date().toISOString();
  lead.country = (request.cf && request.cf.country) || '';
  lead.city = (request.cf && request.cf.city) || '';
  const key = `lead:${lead.received_at}:${crypto.randomUUID().slice(0, 8)}`;
  await env.LEADS.put(key, JSON.stringify(lead), {
    metadata: { name: lead.name, phone: lead.phone, source: lead.source },
  });
  const alert = Promise.all([notifyDiscord(env, lead), notifyEmail(env, lead)]);
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
