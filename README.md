# Encore Salon Suites West Midtown: landing page

Live: https://midtown.encoresalonsuites.com (Cloudflare Pages project `encore-west-midtown`, also at https://encore-west-midtown.pages.dev)
Staging (noindex, demo form): https://searchtech1.github.io/encore-atlanta-staging/ (branch `gh-pages`)

Built to the SES MGT developer brief (23 Oct 2026): ten blocks, mobile first at 390px, no exits except the form, phone and email.

## Layout
- `public/`: the site (single `index.html`, `video/` hero cut + captions, `img/` West Midtown stills)
- `functions/api/lead.js`: `POST /api/lead` stores landing-page tour requests in Cloudflare KV (binding `LEADS`)
- `functions/api/webhook/[token].js`: `POST /api/webhook/<WEBHOOK_TOKEN>` takes leads from Encore's main-site Midtown form (any JSON/form layout)
- `functions/leads/[token].js`: `GET /leads/<LEADS_VIEW_TOKEN>` private list of all Midtown leads (`?format=csv` to export)
- `functions/video/[[path]].js`: serves `/video/*` with byte-range support (Pages ignores Range; iOS needs it)
- Secrets (Pages env): `WEBHOOK_TOKEN`, `LEADS_VIEW_TOKEN` (copies in the macOS keychain, service names `encore-west-midtown-*-token`)
- `.github/workflows/deploy.yml`: every push to `main` deploys to Cloudflare Pages

## Deploy setup (one time)
Repo secrets: `CLOUDFLARE_API_TOKEN` (permission: Account / Cloudflare Pages / Edit) and `CLOUDFLARE_ACCOUNT_ID`.

## Open items
- Lead routing (owner decision 2026-10-24): all Midtown leads come to SES (landing page + main-site webhook). Add an alert (email or chat) so new leads get called fast.
- Social proof block ships hidden; add real tenant quotes (first name + specialty) and remove `hidden`.
- Scarcity line is owner-confirmed as of 2026-10-24; delete it if other locations open up.
