// Contextual tool for the book page: bakes the viewed book into the
// registration (no bookId parameter) and registers only while in stock.
const ctx = JSON.parse(document.getElementById("webmcp-context")?.textContent ?? "{}");
const mc = document.modelContext ?? null;

const cartCount = document.getElementById("cart-count");
const addButton = document.getElementById("add-to-cart");

function addToCart(quantity) {
  const next = Number(cartCount.textContent) + quantity;
  cartCount.textContent = String(next);
  return next;
}

addButton.addEventListener("click", () => addToCart(1));

if (mc?.registerTool && ctx.bookId && ctx.inStock) {
  const controller = new AbortController();
  try {
    await mc.registerTool(
      {
        name: "add_to_cart",
        description:
          "Add the book shown on this page to the visitor's cart. Returns the updated cart count. Checkout stays a human step.",
        inputSchema: {
          type: "object",
          properties: {
            quantity: { type: "integer", description: "How many copies to add.", minimum: 1 },
          },
          required: ["quantity"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        // Chrome ~151 calls execute(input) with no second argument; default
        // the spec's context object so the destructure survives both shapes.
        async execute({ quantity }, { signal } = {}) {
          signal?.throwIfAborted();
          if (!Number.isInteger(quantity) || quantity < 1) {
            return { error: "quantity must be a positive integer." };
          }
          const count = addToCart(quantity);
          return { added: quantity, cartCount: count, bookId: ctx.bookId };
        },
      },
      { signal: controller.signal },
    );
  } catch (err) {
    console.warn("webmcp: add_to_cart registration failed", err);
  }
}
