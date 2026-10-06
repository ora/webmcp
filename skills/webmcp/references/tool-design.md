# Imperative tool design

Design each tool with the user before writing registration code. The
description and schema are the product: an agent chooses and calls tools on
their strength alone.

## Planning pass (per tool, before the gate)

| Question | Example (checkout) |
| --- | --- |
| What human flow exists today? | 4-step tunnel: cart, shipping, payment, review |
| What should the agent call? | one `start_checkout` on step 1 |
| Input | shipping address, saved payment method id |
| UI outcome | land on review step, summary visible, selections filled |
| State outcome | cart + shipping persisted; nothing charged |
| Availability | cart pages, any auth state; aborts when cart empties |
| Boundary | payment itself stays in the app's confirm UI |

Cap the first ship at the smallest set of journey tools (often 1-3);
breadth belongs to Bridge when an MCP server already exists.

## Availability: registration is per document

Tools live on the page that registered them; a full navigation destroys
them. Declare each tool as:

- **everywhere**: registered by app-root code so every page has it (in an
  SPA one registration survives client-side routing). The retrieval tool is
  the model case.
- **contextual**: registered on specific pages or states, and registered
  *differently* per context. A product page bakes the viewed product into
  the tool (no `product_id` param); a listing page requires the id because
  results are plural.

In an SPA, client-side navigation does **not** tear registrations down: a
contextual tool must abort the old registration and register the new one on
every route or param change, and must abort when its target disappears
(empty cart, sold-out event). A stale registration is a broken contract.

Auth is page state: personal and account-write tools register on login and
abort on logout; role-gated tools also key on role. This is UX only;
authorization is enforced server-side on the routes `execute` calls.

## Naming

| Good | Why |
| --- | --- |
| `search_docs` | verb + object, stable |
| `add_to_cart` | immediate, scoped effect |
| `start_checkout` | opens a flow instead of committing |

Avoid opaque names (`doStuff`), synonym overlap (`search` + `find` +
`query`), and anything outside ASCII `[a-zA-Z0-9_.-]` (max 128 chars).

## Descriptions

State what the tool does, when to use it, and what it returns, in positive
language. Encode limits in the schema and errors, not "don't use for X".
For a write, include the consequence ("adds the item to the visitor's
cart"). Never embed instructions to the agent, secrets, or marketing copy;
metadata is a prompt-injection surface the site controls.

## inputSchema

- Top level `type: "object"`; `additionalProperties: false`
- Every property gets a `description`
- Closed sets use `enum` (with human-readable values)
- Accept natural phrasing where possible (a date range as a string beats
  forcing the model to precompute timestamps)
- `required` only for truly required fields
- Schema is a hint: validate again inside `execute` and return actionable
  `{ error }` results so the agent can correct and retry

## execute contract

- Runs the approved wiring path verbatim: client data layer, same-origin
  route, or client-safe action
- Honors `{ signal }`: pass it to `fetch` and cancelable work
- Fails by **returning** `{ error: "actionable message" }` — bad input,
  failed calls, missing anchors or data it depends on. Never throw for
  failure: the spec maps a rejected `execute` to a bare `UnknownError`
  DOMException and discards the message. Rejection is for cancellation
  only (`signal.throwIfAborted()`)
- A read that finds nothing is not a failure: return the empty result plus
  an explicit note field ("no matching products"), never a bare `[]` and
  never an `{ error }`
- Returns small, structured, `JSON.stringify`-safe payloads: enough to
  complete the step and choose the next action, never a full entity dump,
  never just "done". No DOM nodes, class instances, cycles, or `undefined`
- Produces a visible effect whenever it changes state: results render, the
  cart badge updates, the route changes. The user and agent share the page

## Annotations

| Field | Set true when |
| --- | --- |
| `readOnlyHint` | no state change at all |
| `untrustedContentHint` | output can contain user or third-party text (reviews, comments, UGC) |
| `consequentialHint` | the call has significant, real-world or non-reversible effects (booking, payment, sending a message) |
| `debugging` | the tool exists for debugging or developer tooling, not end users |

Mislabeling `readOnlyHint` trains agents to call mutating tools casually.
`consequentialHint` lets agents ask the user before the call, but it is a
hint, not a safeguard: consequences still belong in the description, and
irreversible steps stop at a reversible boundary (pending state + the app's
own confirm UI, or prepare/confirm where confirm requires a token that
prepare returned).

## Lifecycle recipe

```js
let controller = null;

function arm(mc, deps) {
  controller?.abort();
  controller = new AbortController();
  mc.registerTool(makeTool(deps), { signal: controller.signal })
    .catch((err) => console.warn("webmcp: registration failed", err));
}

function disarm() {
  controller?.abort();
  controller = null;
}
```

Register when the tool is meaningful, abort when route/auth/state makes it
invalid, re-register with a fresh controller when it becomes valid again.
Duplicate names reject, so always abort before re-registering the same name.

## Stable identity across re-runs

When re-running this workflow on a repo that already has WebMCP tools, keep
existing tool names stable unless the user asks to rename: agents and tests
may already reference them. Inventory existing names during step 1.
