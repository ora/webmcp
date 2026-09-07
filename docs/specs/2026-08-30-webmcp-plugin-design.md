# webmcp plugin design

Date: 2026-08-30
Status: approved (design reviewed in-session)

## What this is

A coding-agent plugin, published from `ora/webmcp`, that makes websites
WebMCP-compatible: it teaches an agent (Claude Code, Codex, or any skills.sh
host) to audit a web app for agent-readiness, propose page tools, implement
them against the standard `document.modelContext` API, and verify them in a
real browser.

Brand: **ora** (plugin name `webmcp`, marketplace name `ora`, author Ora,
`https://github.com/ora`).

## Decisions (locked with the user)

- **Scope: focused hybrid.** Multiple focused skills with a hard
  plan-approval gate, and zero runtime baggage: no interactive UI server,
  no CLI, no login, no vendor SDK.
- **Runtime target: the standard API only.** `document.modelContext` first
  (the only surface in the current spec), `navigator.modelContext` as a
  legacy-implementation fallback in feature detection only,
  `@mcp-b/webmcp-polyfill` where native support is missing. Content is written
  against the current spec: AbortSignal-only unregistration, `exposedTo`,
  `getTools`/`executeTool`, `toolchange`, permissions-policy `"tools"`, and
  Chrome's origin-trial declarative form API.
- **Platforms: all three.** `.claude-plugin/` (Claude Code),
  `.codex-plugin/` (Codex), `.agents/plugins/` (skills.sh / Cursor).
- **Emphasis:** two things beyond the core workflow: an **audit** skill
  (agent-readiness report before any code is written, aligned with ora's
  find/read/use framing) and **framework depth** (per-framework reference
  files: React/Next, Vue, Svelte, vanilla/MPA).

## Structure

```
.claude-plugin/plugin.json + marketplace.json
.codex-plugin/plugin.json
.agents/plugins/marketplace.json
skills/
  webmcp/    main skill: inventory -> propose paths (hard gate) -> wire ->
             implement (declarative / imperative / bridge) -> verify -> harden
    SKILL.md
    references/ spec.md, strategies.md, tool-design.md, declarative-forms.md,
                runtime.md, security.md
    references/frameworks/ react-next.md, vue.md, svelte.md, vanilla-mpa.md
  audit/     read-only agent-readiness audit -> scored fix-first report
    SKILL.md, references/report-template.md
  verify/    runtime verification ladder + security lint for existing tools
    SKILL.md
README.md (ora voice), LICENSE (MIT), .gitignore
```

## Non-goals

- No generated-code dependency on any vendor SDK.
- No hosted service, telemetry, or data leaving the machine.
- No hooks, MCP servers, or slash commands in v0; skills are the whole surface.

## Quality bar

- Skill descriptions: third person, concrete trigger phrases.
- SKILL.md bodies lean (~1,500-2,500 words), detail in references
  (progressive disclosure).
- Every workflow has a hard approval gate before file writes.
- Verification is mandatory: Chrome DevTools MCP
  (`list_webmcp_tools` / `execute_webmcp_tool`) with a console fallback
  (`getTools` / `executeTool`).
