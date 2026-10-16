# Nerd 4 Sale Gaming — Cloudflare setup

Repository: https://github.com/Nerd-4-Sale-Gaming/nerd4salegaming
Public URL: https://nerd4salegaming.com
Admin URL: https://nerd4salegaming.com/admin

This package includes the complete Windows app and a separate production Cloudflare Worker. Cloudflare runs cloudflare/worker.mjs and serves cloudflare/public. START-WINDOWS.bat still runs the local app; local admin is for loopback testing only.

## 1. Update GitHub

Extract this package into your existing Git checkout. Replace matching files. Keep the existing data folder and Git metadata. The package does not include customer data, secrets, node_modules, or Git metadata.

In Git Bash in the project folder:

```bash
git add .
git commit -m "Prepare Cloudflare hosting and protected admin login"
git push
```

If data was previously committed, .gitignore does not remove its history. Keep customer information out of a public repository.

## 2. Create private storage

In your friend's Cloudflare account, open R2 Object Storage. Activate R2 if required, then create a bucket named exactly:

nerd4salegaming-data

Keep public access disabled. The Worker binding in wrangler.jsonc connects this bucket as BUCKET. No bucket keys belong in the website or repository.

## 3. Configure admin email login

Open Cloudflare Zero Trust for the same account. Complete onboarding if necessary, choosing a team name. Record its URL, which looks like https://YOUR-TEAM.cloudflareaccess.com.

Go to Integrations > Identity providers > Add new identity provider > One-time PIN.

Go to Access > Applications > Add an application > Self-hosted.

Name: Nerd 4 Sale Admin
Public hostname: nerd4salegaming.com
Path: admin
Session duration: choose 8 hours or your preferred duration.

Use an Allow policy, selecting exact Emails:

- nerd4salegaming@gmail.com
- mcgill.patrick92@yahoo.com

Require One-time PIN if the policy offers Login methods. Select One-time PIN as the application's login method. Save the application and copy its Application Audience (AUD) Tag from its settings. Protect the /admin path and descendants; the backend separately protects /admin.html and all privileged API operations.

Do NOT protect the whole public website or every /api path with Access: public cart submissions, inventory browsing, and buy-list uploads must remain available to customers.

Edit wrangler.jsonc:

- ACCESS_TEAM_DOMAIN: your https://YOUR-TEAM.cloudflareaccess.com URL, without a trailing slash.
- ACCESS_AUD: the saved admin Access application's AUD tag.
- ADMIN_EMAILS: the comma-separated approved emails above, plus any vending helpers.

These values identify the Access application; they are not passwords. The Worker validates the signed JWT's issuer, audience, expiry, algorithm, and approved email. It accepts the signed Access cookie on API calls and never trusts a bare email header. Until configuration is complete, all admin access is denied.

### Adding/removing vending helpers

Every approved helper uses their own email and code at /admin; no Cloudflare, GitHub, or ChatGPT account is needed.

To ADD a helper:
1. Add the exact email to the Access Allow policy.
2. Add it to ADMIN_EMAILS in wrangler.jsonc, commit and push.

To REMOVE a helper:
1. Remove it from ADMIN_EMAILS and deploy the change (this rejects existing tokens for that email).
2. Remove it from the Access policy and revoke their active Access sessions.

All approved emails have full site-admin access, including customer contact details, inventory imports and deletion. This version does not have a limited helper role. Do not share a single email code or login.

## 4. Connect GitHub to Cloudflare Workers

In the correct Cloudflare account, go to Workers & Pages > Create application > Import a repository. Connect GitHub and authorize the Nerd-4-Sale-Gaming organization repository. An organization owner may need to approve the Cloudflare GitHub app installation.

Select Nerd-4-Sale-Gaming/nerd4salegaming.

Use:
- Worker/project name: nerd4salegaming (must match wrangler.jsonc)
- Production branch: main
- Root directory: repository root
- Build command: npm run build
- Deploy command: npm run deploy
- Node version: 22 or newer

The committed package-lock.json allows reproducible dependency installation. Cloudflare normally installs dependencies automatically. If the dashboard requires an explicit build installation step, use npm ci && npm run build.

Save and deploy. The configuration attaches nerd4salegaming.com as a custom domain, R2 storage, and a Cron Trigger. If there is a conflicting DNS record at the apex, resolve that specific conflict in Cloudflare rather than deleting unrelated DNS records. www is not configured in this package; add a redirect to the apex separately if wanted.

workers.dev and preview URLs are disabled to avoid a second public origin. Set up Access before sharing admin access.

## 5. Bring over inventory and content

No data is automatically moved from the ChatGPT-hosted demo or your computer.

The easiest start: sign into /admin and upload your current singles ManaBox CSV and sealed TCGplayer CSV. Re-enter events and vendor notes. The bundled sealed product catalog provides exact known Secret Lair contents; importing your CSV sets actual availability.

If you want local carts, buy lists, CSVs, notes and events preserved too, the included migration script can copy the LOCAL data directory to R2. Do not run it against a bucket already containing live customer submissions without reviewing the plan: matching keys are overwritten.

```bash
npm ci
npx wrangler login
node scripts/migrate-local-data.mjs
```

The script above only prints a plan. After verifying the account and plan:

```bash
node scripts/migrate-local-data.mjs --apply
```

The migration needs your data folder in this checkout. It never uploads data to GitHub. It does not retrieve anything from the separately hosted ChatGPT site.

## 6. Verify production

- In a private/incognito window: home loads; /admin requests email-code login.
- An unapproved email cannot log in.
- Direct /admin.html access without a valid signed session is denied.
- GET /api/carts, GET /api/buylists and admin mutations return 403 without a session.
- Approved admins can upload both inventories, see card lists/buy lists, add/edit/delete events, and publish a note.
- Submit a test cart and buy list from a customer window; confirm details in admin, then delete the test records.
- Check card images, prices, mobile controls, and email/Facebook links.

## Pricing schedule

A new singles-wide refresh starts every six hours, aligned to UTC slots 00:00, 06:00, 12:00, and 18:00. Cloudflare invokes a one-minute heartbeat to process up to 450 printings per invocation. Large inventories finish in multiple batches; this avoids request limits and preserves progress. Scheduler progress/errors are in R2 at system/singles-price-refresh.json and in Worker logs. Inventory uploads reset the cursor for the new inventory.

Prices come from Scryfall's latest available pricing fields, not a direct TCGplayer API connection. A six-hour check does not guarantee the upstream price changes six-hourly. Errors retain prior prices and pause retry attempts for 30 minutes. Sealed prices still come from the uploaded TCGplayer export. Archived cart snapshots are never modified by this job.

The separate ChatGPT-hosted demo has its own schedule. Once migration succeeds, disable that old task if you no longer use the demo. The Cloudflare deployment does not depend on that task or on either computer staying on.

## Future code updates

Push changes to main; Cloudflare builds and deploys automatically. Inventory, notes, events, carts and buy lists are stored separately in R2 and do not require GitHub changes. Do not delete the bucket during code updates.

For website edits, change cloudflare/public (production) and public (Windows) together. Backend production handlers live under cloudflare/routes. The original server.mjs and local-*.mjs files serve only the local Windows app.

## Validation performed before delivery

- Worker bundle dry-run succeeded.
- Signed JWT tests cover approved/unapproved email, audience, expiry, invalid signature, signed-cookie API access, and request-context isolation.
- Scheduler tests cover batch resume, six-hour cycle state, retained prices on provider failure, and unchanged archived data.
- Runtime tests check public API access and denial of unauthenticated admin paths/mutations.

Live Cloudflare login, email delivery, account permissions, domain attachment and production data still need testing after deployment in your friend's account.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
