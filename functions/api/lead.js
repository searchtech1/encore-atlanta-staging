// POST /api/lead: stores a tour request in Cloudflare KV (binding: LEADS).
// Read leads with: npx wrangler kv key list --namespace-id <id>  /  kv key get <key> --namespace-id <id>

const FIELDS = ['name', 'phone', 'profession', 'source_form', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  let data = {};
  const type = request.headers.get('content-type') || '';
  try {
    data = type.includes('application/json') ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // Bots fill the hidden "website" field; accept silently and store nothing
  if (data.website) return json({ ok: true });

  const lead = {};
  for (const k of FIELDS) lead[k] = String(data[k] || '').trim().slice(0, 200);
  const digits = lead.phone.replace(/\D/g, '');
  const phoneOk = /^[\d\s().+-]{10,20}$/.test(lead.phone) && digits.length >= 10 && digits.length <= 11;
  if (!lead.name || !phoneOk) return json({ ok: false, error: 'invalid' }, 400);

  lead.received_at = new Date().toISOString();
  lead.country = request.cf && request.cf.country || '';
  lead.city = request.cf && request.cf.city || '';
  lead.user_agent = (request.headers.get('user-agent') || '').slice(0, 300);

  const key = `lead:${lead.received_at}:${crypto.randomUUID().slice(0, 8)}`;
  await env.LEADS.put(key, JSON.stringify(lead));
  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
