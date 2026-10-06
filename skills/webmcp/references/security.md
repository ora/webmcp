# Security

Agents inherit the signed-in user's cookies and session. Treat every tool
as an authenticated capability with the blast radius of the current user.

## Author responsibilities

1. **Least privilege.** Register only tools the current user may use; abort
   personal and role-gated tools on logout or role change.
2. **Server-side authorization.** Registration gating is UX. Every mutating
   path a tool calls must independently enforce authn/authz on the server.
   An endpoint protected only by a hidden client button is not wrappable;
   report it as needs-developer-wiring.
3. **Reversible boundaries.** Payments, deletes, cancellations never
   complete in one agent call. Create the app's own pending state and hand
   the final step to its confirm UI, or use prepare/confirm where confirm
   requires a token prepare returned. A warning sentence in the description
   is not a boundary.
4. **Honest annotations.** `readOnlyHint`, `untrustedContentHint` and
   `consequentialHint` must match reality; wrong hints train agents into
   unsafe call patterns.
5. **No tool poisoning.** Never put instructions to the agent, secrets, or
   exfiltration bait in `name`, `title`, `description`, or parameter
   descriptions. Keep metadata boring and accurate.
6. **Safe outputs.** Bound and sanitize user-generated content in returns;
   set `untrustedContentHint: true` when in doubt; avoid echoing raw HTML.
   Never return secrets, tokens, or bulk PII.
7. **Validate in code.** `inputSchema` is a hint; re-validate inside
   `execute` and reject bad input with actionable errors.

## Prompt-injection surfaces

| Vector | Mitigation |
| --- | --- |
| Tool metadata | the site controls it; keep it factual, review in code review |
| Tool output containing UGC | sanitize/bound, mark `untrustedContentHint` |
| Confused deputy via session | server-side authz + CSRF protection on every cookie-authenticated mutation |
| Declarative `toolautosubmit` | never on destructive or payment forms |

## Cross-origin

- Default is same-origin only; that is the safe default, keep it.
- Sharing into another frame requires the parent's `allow="tools"` plus an
  explicit `exposedTo` allowlist of secure origins the site controls.
- Audit `exposedTo` lists in code review like CORS origins.

## What WebMCP does not replace

- Server authorization and rate limiting
- CSRF protection on cookie-authenticated APIs
- Human approval UX for high-risk actions
- Fraud and abuse controls on payments
