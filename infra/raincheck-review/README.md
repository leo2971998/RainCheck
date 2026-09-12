# RainCheck read-only ZeroClaw adapter

Installed on `10.0.0.141` at `/home/leo29798/raincheck-review`, listening **only** on
`127.0.0.1:43120`. The user service is `raincheck-review.service`.

## Current deployment status

- Dedicated agent and server-local authentication are installed and running.
- Cloud review with the existing Codex login was tested against an engine-calculated
  synthetic Nessie subscription preview. No real account data was submitted.
- **The new public HTTPS paths are NOT activated yet**: administrator access is
  required. The original Nginx configuration and application routes are unchanged.
- This does **not** enable a website AI button or deploy anything to Vercel.
  There is no anonymous paid-model route in RainCheck.

## Activate HTTPS

On `leo-server`, as the administrator:

```sh
sudo python3 /home/leo29798/raincheck-review/activate_https.py
```

This adds only `/raincheck/health` and `/raincheck/reviews` under the existing
`zeroclaw.leo-photoserver.com` TLS virtual host. It preserves the original default
route to DailyRoutine and does not touch PokeTeam's virtual host. It backs up the
original config, validates Nginx, and restores it if validation/reload fails.

The hostname currently has no working DNS record. The test client connects to
the **public IP `98.44.156.202`** and still verifies the hostname's certificate
using SNI. It never disables certificate validation. This is not a DNS repair;
review this pinned IP if the server's public address changes.

After activation, from the RainCheck project with its dev server running:

```sh
node scripts/test-zeroclaw.mjs --public
```

Without `--public`, the script tests server loopback over SSH. It loads the
synthetic demo through the current RainCheck data adapter, uses `budgetImpact`
to calculate a monthly subscription preview, and sends only the minimal brief
through SSH stdin. It never changes the plan or writes Nessie records.

## Security and boundaries

- A separate random API secret is stored in `.api-key` on the server, mode `600`.
  The enclosing directory is `700`. **Do not put this key in `VITE_*`, client code,
  a URL, Git, or chat.** The website backend must authenticate, not the browser.
- POST and result retrieval require bearer authentication. Browser-origin requests
  are rejected. The unauthenticated health check does not call the model.
- Strict, bounded JSON accepts only synthetic source labels, dates, amounts in
  integer cents, and calculator affordability results. No arbitrary prompt,
  merchant names, account identifiers, transactions, bank credentials or URLs.
- The future website adapter must rebuild the brief from a trusted dataset and
  validated plan inputs. Do not relay arbitrary browser-supplied financial facts.
  The service interprets supplied calculator facts; it cannot attest their origin.
- Tool-free ZeroClaw profile: no shell tools, delegates, skills, MCP, persistent
  agent memory, response cache or content traces. Plain model explanations remain
  fallible; evidence references verify provenance, not semantic correctness.
- Exact amounts and checking/goal assessments come from the calculator, never
  model prose. Goal contribution arithmetic is not treated as affordability.
- Maximum one active review, five new attempts per minute, thirty per hour across
  all clients. Failed attempts count. Limits and completed-result caching survive
  restarts. Provider execution is bounded to seventy-five seconds and output size.
- Only the existing Codex **access token** and encryption key are copied internally
  before review. Refresh/ID tokens are excluded; the original login files are
  untouched. An expired login needs renewal through its existing normal flow.
  Provider-side policies and usage limits still apply.

## Review storage

Private SQLite in `state/reviews.sqlite3` stores operational review records:
UUID before generation, timestamp, contract/model, minimal synthetic input,
status, validated explanation, and service identity. Token usage/cost are `null`
because this CLI does not report them; they are not reported as zero.

Authenticated `GET /raincheck/reviews/<id>` retrieves a saved result. Identical
completed requests reuse the result for one hour; the hash includes the contract
and model. Failure details are generic and never contain provider output or keys.
The records are local to this isolated service, not a new source of bank facts.
Supabase's existing retrieval mirror and Nessie's data are unchanged. Before
supporting real users, add user-scoped authorization, a retention policy, and
Supabase-backed app review history. Do not expose the shared service key to users.

## Operate and test

```sh
python -m unittest discover -s infra/raincheck-review -p "test_*.py"
npm test
npm run build
```

Server service controls, as `leo29798`:

```sh
systemctl --user status raincheck-review
systemctl --user restart raincheck-review
systemctl --user disable --now raincheck-review
```

Stopping the service does not affect the other applications; its own new routes
will be unavailable until restarted. No DNS, certificate, firewall or original
application settings are changed by `provision.py`.
