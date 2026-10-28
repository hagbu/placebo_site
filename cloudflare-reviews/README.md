# Placebo Google reviews

This service runs alongside the static GitHub Pages site. Only manually approved
reviews are returned by `/api/reviews`. No Google credentials are sent to visitors.
The live site remains unchanged until the frontend changes are pushed to GitHub.

## Deploy to the existing Worker

The existing Worker is `placebo-reviews` at
`https://placebo-reviews.hagbior.workers.dev`. It already has a D1 binding named
`DB`, a `GOOGLE_CLIENT_ID` variable and a `GOOGLE_CLIENT_SECRET` Secret.

1. Add a Production **Secret** named `ADMIN_PASSWORD`. Use a unique password of
   at least 20 ASCII letters, numbers and/or symbols. Keep it in your password manager.
   Do not use your Google password.
2. Run `node cloudflare-reviews/build.mjs` after changing the source. The generated
   `worker.js` is a single ES module that can replace the entire default Hello
   World code in **Edit code**. It contains no secrets. Deploy it to the existing
   Worker; keep the existing DB binding and variables.
3. Visit `https://placebo-reviews.hagbior.workers.dev/admin`. The browser's sign-in
   dialog uses username `placebo` and the `ADMIN_PASSWORD` you set above.
4. Click the Google connection button and choose the account that manages the
   business. The code verifies access to the configured location before saving
   the connection. The OAuth callback already registered in Google must be:
   `https://placebo-reviews.hagbior.workers.dev/oauth/callback`.
5. Read a review and approve it. Check `/api/reviews` contains only your approvals.
   Hiding it must remove it from that endpoint immediately.
6. Add a **Cron Trigger** under the Worker's Settings / Trigger events, using
   `0 */6 * * *` (every six hours, UTC). This is necessary for unattended refresh
   and deletion of old cached content. It is already declared in `wrangler.jsonc`
   if deploying with the CLI. The manual dashboard code deployment does not
   install that configuration automatically.
7. Commit/push the homepage changes through the project's normal GitHub workflow
   after verifying the service. The homepage is configured to request the public
   feed from this Worker; it hides the reviews section on errors or an empty feed.

For CLI deployments, use the official Wrangler CLI in this directory. Authenticate
to the Cloudflare account, then run `wrangler deploy`. `keep_vars` preserves the
dashboard's client ID. Never include secrets in the config or a Git commit.

## Behaviour

- Google access is read-only in this code. No replies, edits or deletions on Google
  are implemented, despite Google's broad `business.manage` permission.
- The private admin screen loads Google's latest 50 reviews per page; the next-page
  button allows reading older reviews. Content is rendered as text, never HTML.
- Up to 12 reviews may be selected for the homepage. This is an explicit small
  curated collection; all reviews remain accessible through the Google Maps link.
- Each approval is bound to the exact fetched review content. Changes detected
  during refresh return that review to pending. If a review changes between
  reading and approving, the server refuses approval until it is reloaded.
- Hidden review IDs stay hidden across synchronization. They are local decisions,
  not Google moderation. The average and total count always come from Google,
  never from the selected subset.
- The cron refreshes the summary and selected reviews. Admin page loads import
  current reviews on demand. Newly received Google reviews are never automatically
  published. Deleted reviews are removed when Google returns 404.
- Public content expires after 24 hours without successful refresh. A failed Google
  request cannot extend that expiry. Cached review bodies are cleared after 29 days
  by the scheduled cleanup, including when Google is unavailable. Keep the cron
  enabled. D1 backups are managed separately by Cloudflare.
- Refresh tokens are AES-GCM encrypted at rest using a key derived from the admin
  password; Google's client secret stays in the Worker Secret. Changing the admin
  password requires reconnecting Google. Responses and the public feed use
  `Cache-Control: no-store`, so hiding is not delayed by an application cache.
- Admin access uses HTTPS Basic authentication, a long unique password, origin
  checks for writes, single-use OAuth state tied to a browser cookie, PKCE, restrictive
  page headers and per-IP password-attempt limiting. Protect the password as you
  would a private admin account. No admin credential is stored in homepage code.
- Disconnect clears tokens and cached content immediately and attempts revocation
  with Google; moderation choices remain for a later reconnection.

## Testing and production readiness

Run with Node 22.13+:

```sh
node cloudflare-reviews/test/worker.test.mjs
node cloudflare-reviews/build.mjs
node --check reviews-carousel.js
node --input-type=module --check < cloudflare-reviews/worker.js
python3 scripts/check_css_links.py
```

Tests use SQLite and fake Google responses, not real credentials or reviewer data.
They cover approval/hiding, updated and deleted reviews, stale content, encrypted
tokens, OAuth replay and wrong accounts, authorization, CSRF and the selection cap.
Live OAuth and the scheduled job still require verification in Cloudflare.

The Google OAuth app is currently configured as External / Testing. Google can
expire refresh tokens issued in testing after seven days for this scope. Before
launch, complete Branding, privacy/terms information, move to the appropriate
production publishing state, and complete any verification Google requires. The
Business Profile API allowlist approval is separate from OAuth publication.
During testing the admin supports reconnecting when a token expires.

The current service defaults to the verified account/location IDs and the existing
Google Maps link. Optional variables `SERVICE_ORIGIN`, `PUBLIC_ORIGINS` (comma-separated
origins), `GOOGLE_ACCOUNT_ID`, `GOOGLE_LOCATION_ID`, and `GOOGLE_MAPS_URL` override them.
Default public origins include `https://hagbu.github.io`, `https://placebo.co.il` and
`https://www.placebo.co.il`; the GitHub repository path is not part of a browser origin.
The service can keep its workers.dev address when the frontend moves to the new
domain, so the Google redirect does not need to change at that point.

## References

- [Business Profile API policies and content storage](https://developers.google.com/my-business/content/policies)
- [Google web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Review listing API](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
