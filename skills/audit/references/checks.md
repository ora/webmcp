# Audit checks by layer

Score each layer 0-100 from its checks; report status strong (>=75),
partial (40-74), or needs work (<40). Every check cites the file, URL, or
observation that decided it. Checks that cannot run (site not runnable, no
browser) are marked not-assessed and excluded from the layer score rather
than counted against it.

## Find: discovery and orientation

| Check | Evidence to look for |
| --- | --- |
| Sitemap present and current | `sitemap.xml` route or file, referenced from robots |
| robots.txt sane | exists, does not block the whole site from crawlers |
| llms.txt / agents guidance | `llms.txt`, `agents.md`, or equivalent at the root |
| Titles and meta descriptions | per-route titles, not one global default |
| Structured data | JSON-LD for the site's core entities (products, events, articles) |
| Server-rendered or pre-rendered core content | homepage and key pages readable without executing the app bundle |

## Read: extraction

| Check | Evidence to look for |
| --- | --- |
| Semantic HTML | headings hierarchy, landmarks, lists/tables for listable data |
| Real forms | `<form>` elements with labeled controls, not click-handler widgets |
| Content reachable by URL | key entities have stable, linkable routes |
| Public API or docs surface | OpenAPI/docs pages, documented endpoints |
| Text alternatives | critical info not locked in images or canvas |

## Use: action (weight highest)

| Check | Evidence to look for |
| --- | --- |
| WebMCP tools registered | `document.modelContext.getTools()` non-empty; `modelContext` / `toolname` in source |
| WebMCP code current | API names, annotation keys and event names in source all exist in the "IDL Index" of the live draft (https://webmachinelearning.github.io/webmcp/); renamed or removed ones are findings |
| Existing MCP server | MCP endpoint in code or docs (bridge candidate) |
| Forms annotatable | real forms that could take `toolname` / `tooldescription` today |
| Client-reachable action paths | stores/APIs a page tool could call without server-only imports |
| Auth handoff | an agent can bring a human to login/confirm screens and resume |
| Reversible boundaries | payments and destructive actions have a pending/confirm step, not one-shot endpoints |
| Journey completability | the core journey (buy/book/enroll/read) has no agent-blocking wall (captcha-only gates, canvas-only UI) |

## Scoring notes

- Layer score = weighted judgment over its checks, anchored to evidence;
  round to a multiple of 5 to avoid false precision.
- Overall = Find 25%, Read 30%, Use 45%.
- A site can score well with zero WebMCP tools if forms are clean and an
  MCP server exists; the proposal section then shows how far the bridge or
  declarative strategy alone would go.
