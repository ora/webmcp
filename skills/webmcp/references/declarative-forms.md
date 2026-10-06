# Declarative: tools from existing forms

The declarative API turns a standard `<form>` into a tool via attributes.
The browser synthesizes `inputSchema` from the controls and fills fields
visibly. Browsers without WebMCP ignore the attributes; the form keeps
working for humans. Exact attribute contract: [spec.md](spec.md).

## Inventory first

Find real `<form>` elements: server-rendered templates, static HTML, client
components that still emit `<form>`. Click-handler widgets with no `<form>`
need the Imperative strategy instead.

For each candidate form, propose to the user:

- `toolname` (verb + object, ASCII `[a-zA-Z0-9_.-]`)
- one-line `tooldescription` (what it does, when to use it)
- whether `toolautosubmit` is appropriate: low-risk search/filter usually
  yes; purchase, delete, send usually no, so a human clicks Submit
- fields needing `toolparamdescription` because the `<label>` is vague

Do not annotate every form blindly. Skip captcha, password reset, and
internal debug forms unless the user asks.

## Minimal patch

```html
<form
  action="/search"
  method="get"
  toolname="search_catalog"
  tooldescription="Search the product catalog by keyword and show matching results on this page."
  toolautosubmit
>
  <label for="q">Search</label>
  <input
    id="q"
    type="search"
    name="q"
    required
    toolparamdescription="Keywords or product name to search for."
  />
  <button type="submit">Search</button>
</form>
```

Control `name` becomes the schema property; `required` carries over; radio
groups take their description from the nearest parent `<fieldset>`.

## Agent submit vs human submit

- Default: the agent fills fields; the human reviews and clicks Submit.
- `toolautosubmit`: the agent may submit and navigate immediately.
- To return a structured result to the model instead of navigating, handle
  `submit`, check `event.agentInvoked`, `preventDefault()`, and
  `event.respondWith(promise)` with a JSON-serializable value.

## Visible feedback

Style the agent-driven states so users see what is happening:

```css
form:tool-form-active { outline: 2px solid highlight; }
:tool-submit-active   { outline: 2px solid highlight; }
```

Listen for `toolactivated` / `toolcancel` on `document.modelContext` when
the app should react (for example, expanding a collapsed form the agent just
filled), filtering on `event.toolName`. Feature-detect them: older previews
may not fire them; never make correctness depend on them.

## Done when

- [ ] Each approved form has `toolname` + `tooldescription`
- [ ] Vague fields have `toolparamdescription`
- [ ] Destructive forms omit `toolautosubmit`
- [ ] Tools appear in verification on the pages the forms live on
- [ ] One agent execution fills (and, where allowed, submits) a form end to end
