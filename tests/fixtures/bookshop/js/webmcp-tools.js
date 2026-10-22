// Site-wide WebMCP tool, loaded by every page (MPA: registrations die on
// navigation, so each page re-registers). Follows the plugin's own rules:
// feature detection, awaited registration in try/catch, honest annotations,
// failures returned as { error } (a rejected execute reaches agents as a
// bare UnknownError), empty results carry a note, JSON-serializable returns.
const mc = document.modelContext ?? null;

if (mc?.registerTool) {
  const controller = new AbortController();
  try {
    await mc.registerTool(
      {
        name: "search_books",
        description:
          "Search the Paged & Bound catalog by title, author, or keyword. Returns up to five matches with title, author, price, and page URL.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Title, author, or keywords to search for." },
          },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        // Chrome ~151 calls execute(input) with no second argument; default
        // the spec's context object so the destructure survives both shapes.
        async execute({ query }, { signal } = {}) {
          const res = await fetch("books.json", { signal });
          if (!res.ok) return { error: `Catalog unavailable (${res.status}). Retry shortly.` };
          const books = await res.json();
          const q = String(query).toLowerCase();
          const matches = books
            .filter((b) => `${b.title} ${b.author} ${b.tags.join(" ")}`.toLowerCase().includes(q))
            .slice(0, 5);
          renderResults(matches);
          return matches.length
            ? { matches }
            : { matches: [], note: "No books matched this query. Try a broader term." };
        },
      },
      { signal: controller.signal },
    );
  } catch (err) {
    console.warn("webmcp: search_books registration failed", err);
  }
}

function renderResults(matches) {
  const list = document.getElementById("results");
  if (!list) return;
  list.replaceChildren(
    ...matches.map((b) => {
      const li = document.createElement("li");
      li.textContent = `${b.title} — ${b.author} ($${b.price})`;
      return li;
    }),
  );
}
