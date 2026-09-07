# webmcp

Get your website ready for AI agents: audit, implement, verify.

WebMCP lets a web page register typed tools that in-browser AI agents call
directly. Agents act through your site's own logic instead of scraping the
DOM. This plugin teaches your coding agent (Claude Code, Codex, or any
skills.sh host) to audit your site, propose the right tools, implement them
on the standard `document.modelContext` API, and verify them in a real
browser.

Built by [Ora](https://ora.ai), the agent-readiness ranking. No login, no
hosted service, no telemetry. Your code stays on your machine. Generated
page tools target only the standard API; the optional bridge strategy uses
a small MIT library, [`@ora-ai/webmcp-bridge`](packages/webmcp-bridge/README.md).

## Install

**Claude Code**

```
/plugin marketplace add ora/webmcp
/plugin install webmcp@ora
```

**Codex**

```
codex plugin marketplace add ora/webmcp
codex plugin add webmcp
```

**Cursor / skills.sh**

```
npx skills add ora/webmcp
```

## What you get

Three skills. `webmcp` stops for your approval before touching any file;
`audit` writes one report (`webmcp-audit.md`) and no code; `verify` changes
nothing.

| Skill | What it does |
| --- | --- |
| `webmcp` | The full workflow: inventory your app, propose tools per user journey, implement, verify, harden |
| `audit` | Read-only agent-readiness report: scored findings across find/read/use, fix-first list, proposed tool table. Writes no code |
| `verify` | Runtime check of existing tools: registration, invocation, security lint. Reports each tool as verified, failed, or could-not-verify |

Plus two small MIT packages:

- [`@ora-ai/webmcp-verify`](packages/webmcp-verify/README.md): a CLI that
  launches your installed Chrome with WebMCP enabled, lists a page's
  registered tools, lints them, and executes them the way an agent would.
  `npx @ora-ai/webmcp-verify http://localhost:3000` — no flags, no Canary,
  no console pasting.
- [`@ora-ai/webmcp-bridge`](packages/webmcp-bridge/README.md): registers
  your existing remote MCP server's tools on `document.modelContext`, for
  the bridge strategy. Built on the official MCP SDK.

Generated page tools still need no SDK at all.

## Use it

```
> Audit this site's agent-readiness
> Make this app WebMCP-compatible
> Verify my WebMCP tools
```

The plan comes first. You approve which journeys become tools, then the
agent implements against the standard API: imperative `registerTool` tools
(the default — every WebMCP runtime reads them), declarative form
annotations (Chrome preview only; runtimes that read registered tools, such
as ChatGPT Site tools, never see them), or a bridge to an MCP server you
already run.

## Principles

- **Standard API only.** Generated code targets `document.modelContext`
  with feature detection and graceful no-op — no SDK required. The one
  library this plugin may add is `@ora-ai/webmcp-bridge`, only for the
  opt-in bridge strategy (mirroring an MCP server you already run).
- **Journeys, not endpoints.** Tools map to what a visitor asks and asks
  for. Most sites need 3 to 10 tools. A blog needs 1.
- **Approval before implementation.** Tool selection is a product decision.
  No code is written until you say yes; `audit`'s only artifact is its
  report file.
- **Verified, not assumed.** Every tool is exercised in a browser the way
  an agent would call it.
- **Safe by default.** Server-side authorization stays mandatory. Payments
  and deletes stop at a reversible boundary. Honest annotations.

## Requirements

- A locally runnable website. Any stack: the skills cover React/Next, Vue,
  Svelte, and vanilla or server-rendered MPAs.
- For browser verification: Chrome. `npx @ora-ai/webmcp-verify` launches
  it with the right flags itself; non-Chromium browsers need
  `@mcp-b/webmcp-polyfill`.

## Development

- `node scripts/check.mjs` runs the repo checks CI runs: manifest
  validity, version sync, skill frontmatter, link integrity.
- `npm install` at the repo root sets up the git hooks (husky):
  conventional-commit messages via commitlint, and check + lint + tests
  on push. `npm run lint` lints the bridge package (eslint).
- `tests/fixtures/bookshop/` is a small static site for exercising the
  skills by hand; its README lists the expected outcome per skill.
- `evals/` holds cases for `claude plugin eval` (early access).
- Issues and PRs welcome. The skills are plain markdown; the bar for
  changes is accuracy against the current spec and Chrome docs.

## WebMCP resources

- Spec: https://webmachinelearning.github.io/webmcp/
- Chrome docs: https://developer.chrome.com/docs/ai/webmcp/imperative-api

## About Ora

Ora ranks how ready products are to be used by AI agents. WebMCP tools are
one of the strongest signals in the usability layer. Run a free scan of
your site at [ora.ai](https://ora.ai), or from the terminal:
`npx @ora-ai/ax audit your-site.com`.

Ora is a product of Era Labs; the GitHub org is
[ora](https://github.com/ora).

## License

MIT
