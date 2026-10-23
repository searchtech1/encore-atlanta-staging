# Encore Salon Suites West Midtown: landing page

Live: https://midtown.encoresalonsuites.com (Cloudflare Pages project `encore-west-midtown`, also at https://encore-west-midtown.pages.dev)
Staging (noindex, demo form): https://searchtech1.github.io/encore-atlanta-staging/ (branch `gh-pages`)

Built to the SES MGT developer brief (23 Oct 2026): ten blocks, mobile first at 390px, no exits except the form, phone and email.

## Layout
- `public/`: the site (single `index.html`, `video/` hero cut + captions, `img/` West Midtown stills)
- `functions/api/lead.js`: `POST /api/lead` stores tour requests in Cloudflare KV (binding `LEADS`)
- `.github/workflows/deploy.yml`: every push to `main` deploys to Cloudflare Pages

## Deploy setup (one time)
Repo secrets: `CLOUDFLARE_API_TOKEN` (permission: Account / Cloudflare Pages / Edit) and `CLOUDFLARE_ACCOUNT_ID`.

## Open items
- Lead delivery: leads are stored in KV only. Decide with Encore where they should go (email, CRM, Gravity Forms) and add it to `functions/api/lead.js`.
- Social proof block ships hidden; add real tenant quotes (first name + specialty) and remove `hidden`.
- Scarcity line is owner-confirmed as of 2026-10-24; delete it if other locations open up.
