// GET /leads/<LEADS_VIEW_TOKEN>: private list of every Midtown lead (landing page + main site). ?format=csv for export.
import { tokenOk } from '../_lib/leads.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLS = ['received_at', 'source', 'name', 'phone', 'email', 'profession', 'message', 'utm_source', 'utm_campaign', 'source_form', 'city'];

async function allLeads(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.LEADS.list({ prefix: 'lead:', cursor, limit: 1000 });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const rows = await Promise.all(keys.map(async (k) => ({ key: k, ...(JSON.parse((await env.LEADS.get(k)) || '{}')) })));
  return rows.sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
}

export async function onRequestGet({ env, params, request }) {
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
  if (!tokenOk(params.token, env.LEADS_VIEW_TOKEN)) return new Response('Not found', { status: 404, headers });
  const leads = await allLeads(env);

  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const csv = [COLS.join(',')].concat(leads.map((l) => COLS.map((c) => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    return new Response(csv, { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="encore-west-midtown-leads.csv"' } });
  }

  const fmt = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rows = leads.map((l) => `<tr>
    <td>${esc(fmt(l.received_at))}</td><td><span class="src ${l.source === 'main-site' ? 'ms' : ''}">${l.source === 'main-site' ? 'Main site' : 'Landing page'}</span></td>
    <td><strong>${esc(l.name)}</strong></td><td><a href="tel:${esc(String(l.phone).replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a></td>
    <td>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ''}</td><td>${esc(l.profession)}</td>
    <td>${esc(l.utm_source || '')}</td><td class="msg">${esc(l.message || '')}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>West Midtown leads (${leads.length})</title><style>
body{margin:0;background:#FBF8F5;color:#2A201D;font:15px/1.5 system-ui,-apple-system,sans-serif}
header{padding:22px 22px 8px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
h1{margin:0;font:400 26px Georgia,serif}.count{color:#6E5D57}
a.csv{color:#fff;background:#8E2C3E;border-radius:999px;padding:9px 18px;text-decoration:none;font-weight:500}
.wrap{overflow-x:auto;padding:0 22px 40px}table{border-collapse:collapse;width:100%;min-width:860px;background:#fff;border-radius:16px;overflow:hidden}
th,td{padding:12px 14px;text-align:left;border-bottom:1px solid #F1E2DD;vertical-align:top}th{font-weight:500;color:#6E5D57;background:#F7EEEA;font-size:13px}
td a{color:#8E2C3E}.src{font-size:12.5px;border-radius:999px;padding:3px 10px;background:#F1E2DD}.src.ms{background:#E8EEF7}.msg{max-width:280px;color:#6E5D57}
.empty{padding:40px;text-align:center;color:#6E5D57}</style></head><body>
<header><div><h1>Encore West Midtown leads</h1><div class="count">${leads.length} total · newest first · times in Atlanta (ET)</div></div><a class="csv" href="?format=csv">Download CSV</a></header>
<div class="wrap"><table><thead><tr><th>Received</th><th>Source</th><th>Name</th><th>Phone</th><th>Email</th><th>Profession</th><th>Ad source</th><th>Message</th></tr></thead>
<tbody>${rows || '<tr><td colspan="8" class="empty">No leads yet.</td></tr>'}</tbody></table></div></body></html>`;
  return new Response(html, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
}
