# WebMCP API contract (current spec snapshot)

Snapshot: 2026-10-02

Snapshot of https://webmachinelearning.github.io/webmcp/ plus Chrome's
preview surface. When this file and the live spec disagree, the live spec
wins; re-check it before relying on edge details. The `Snapshot:` line
above is machine-read by `.github/workflows/spec-drift-watch.yml`; move it
forward whenever this file is re-verified against the current draft.

## Surface

- **`document.modelContext`** returns the `ModelContext` object. This is the
  only surface in the spec. It is `SecureContext`-gated: HTTPS or localhost.
- **`navigator.modelContext` is not in the spec.** Chrome ≤149 previews and
  some older polyfills exposed it; Chrome 150 moved the getter to `document`
  (version table below). New code detects `document` only:

```js
function getModelContext() {
  return typeof document !== "undefined"
    ? (document.modelContext ?? null)
    : null;
}
```

## registerTool

```webidl
Promise<undefined> registerTool(
  ModelContextTool tool,
  optional ModelContextRegisterToolOptions options = {}
)
```

Tool descriptor:

| Field | Required | Contract |
| --- | --- | --- |
| `name` | yes | 1-128 chars, ASCII `[a-zA-Z0-9_.-]` only, unique; duplicate name **rejects the registration promise** |
| `description` | yes | non-empty; what it does, when to use it, what it returns |
| `execute` | yes | `async (input, { signal }) => any`; return must survive `JSON.stringify`. A rejection reaches the agent as a bare `UnknownError` DOMException (message discarded) — fail by returning `{ error }` instead; reject only for cancellation |
| `title` | no | human-readable label |
| `inputSchema` | no | JSON Schema object; use `type: "object"`, describe every property, set `additionalProperties: false` |
| `annotations` | no | `{ readOnlyHint?, untrustedContentHint?, consequentialHint?, debugging? }`, all booleans defaulting to `false` |

Annotations:

| Hint | Set true when |
| --- | --- |
| `readOnlyHint` | the tool changes no state |
| `untrustedContentHint` | the result can carry user or third-party content |
| `consequentialHint` | executing it has significant, real-world or non-reversible effects (booking, payment, sending); agents may require user confirmation first |
| `debugging` | the tool is meant for debugging and developer tooling, not end-user interactions |

Options:

| Field | Contract |
| --- | --- |
| `signal` | `AbortSignal`; aborting it **unregisters the tool**. This is the only unregistration mechanism: `unregisterTool()`, `provideContext()`, and `clearContext()` do not exist |
| `exposedTo` | list of origins allowed to see/call the tool from other documents; default is same-origin only |

Re-registering after abort requires a **new** `AbortController`.

## Introspection and self-testing

```webidl
Promise<sequence<RegisteredTool>> getTools(optional { fromOrigins })
Promise<DOMString> executeTool(RegisteredTool tool, optional object input, optional options)
```

`getTools()` sees registered tools across the document tree (subject to
origin exposure). `executeTool()` lets the page (or a console/test harness)
invoke a tool exactly as an agent would; use it for verification. It
resolves to a **DOMString** — the `execute` return value serialized as
JSON — so parse it before asserting on fields. Omitting the input is the
same as passing an empty object.

## Events

All three fire on `ModelContext`, with matching `on…` handler properties:

- `toolchange` when tools register or unregister.
- `toolactivated` (`ToolActivatedEvent`, `event.toolName`) right before a
  tool's `execute` is invoked.
- `toolcancel` (`ToolCancelEvent`, `event.toolName`) when the caller aborts a
  pending execution; the tool's execute `signal` aborts at the same time.

Feature-detect the last two: preview builds older than the 2026-09-17 draft
may not fire them, and some fired a form-level `toolcanceled` instead.

## Cross-origin and iframes

- Permissions Policy feature name: **`"tools"`**, default allowlist `['self']`.
- A cross-origin iframe needs the parent to delegate:
  `<iframe src="https://widget.example" allow="tools">`.
- The iframe's tools become visible to other documents only for origins
  listed in `exposedTo`. Only secure (potentially trustworthy) origins are
  valid. Never list origins the site does not control.

## Declarative form API (Chrome origin trial)

The spec marks the declarative section TODO; the shipped behavior is
Chrome's origin trial (see the declarative-api explainer in the spec repo).

Form attributes:

| Attribute | On | Role |
| --- | --- | --- |
| `toolname` | `<form>` | tool id; removing it unregisters the tool |
| `tooldescription` | `<form>` | agent-facing purpose; also required for registration |
| `toolautosubmit` | `<form>` | boolean; agent may submit and navigate without a human click |
| `toolparamdescription` | controls / `<fieldset>` | property description in the synthesized schema; falls back to `<label>` text, then `aria-description` |

Schema synthesis: control `name` becomes the property name; `required`
carries into the schema; radio groups take their description from the
nearest parent `<fieldset>`.

Submit handling:

- `SubmitEvent.agentInvoked` is `true` when an agent triggered the submit.
- `event.respondWith(promise)` (after `preventDefault()`) returns a
  JSON-serializable result to the model instead of navigating.

```js
form.addEventListener("submit", (event) => {
  if (!event.agentInvoked) return;
  event.preventDefault();
  event.respondWith(runSearchAndReturnHits());
});
```

Events: listen for `toolactivated` and `toolcancel` on
`document.modelContext` (see Events above) and filter on `event.toolName`.
The form-level `toolcanceled` spelling from older Chrome previews is not in
the spec.
CSS state: `form:tool-form-active`, submit control `:tool-submit-active`.

## Registration failure taxonomy

`await registerTool()` inside `try`/`catch`; on current Chrome it returns a
`Promise<void>` that rejects, while older preview builds threw
synchronously, and the same `await` + `catch` handles both:

| Error | Cause |
| --- | --- |
| `InvalidStateError` | duplicate name; empty `name`/`description`; name over 128 chars or outside `[a-zA-Z0-9_.-]` |
| `NotAllowedError` | `"tools"` Permissions Policy denied (cross-origin iframe missing `allow="tools"`) |
| `SecurityError` | `exposedTo` lists an untrusted origin (non-secure / not potentially trustworthy); `getTools()` rejects the same way for `fromOrigins` |
| `TypeError` / serialization errors | non-JSON-serializable or circular `inputSchema` |

## Chrome preview timeline (verify before promising)

WebMCP ships as a Chrome early preview behind
`chrome://flags/#enable-webmcp-testing`. The surface has moved with each
release; these transitions explain most stale examples in the wild:

| Since | Change |
| --- | --- |
| Chrome 146 | preview available behind the flag, `navigator.modelContext` surface |
| Chrome 148 | `registerTool()` accepts `{ signal }`; `unregisterTool()` removed |
| Chrome 150 | getter moved to `document.modelContext`; `navigator.modelContext` deprecated |
| Chrome 151 | `registerTool()` returns `Promise<void>` (was synchronous) |
| Chrome 153 | `execute` always receives `{ signal }`; unregistering no longer cancels in-flight executions (lifecycle and execution cancellation are independent) |

Non-Chromium browsers need `@mcp-b/webmcp-polyfill`. Availability moves
quickly; trust the Chrome docs listed in SKILL.md over version numbers in
third-party READMEs, including this table.

## Removed / renamed things still found in old examples

| Seen in the wild | Status |
| --- | --- |
| `navigator.modelContext` as primary surface | deprecated; new code reads `document.modelContext` only |
| `unregisterTool(name)` | removed; abort the registration signal |
| `provideContext()` / `clearContext()` / `toolparamtitle` | removed |
| synchronous `registerTool()` examples with no `await` | works only on old previews; always `await` |
| returning DOM nodes or class instances from `execute` | never valid; JSON-serializable only |

## Inspection tooling

The Model Context Tool Inspector extension (GoogleChromeLabs/webmcp-tools)
lists registered tools and executes them manually; some preview tooling
uses `navigator.modelContextTesting`. Diagnostic aids only, never runtime
dependencies.
