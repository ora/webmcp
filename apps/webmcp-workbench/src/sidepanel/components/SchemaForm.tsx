import { useEffect, useState } from "react";
import { SchemaField } from "./SchemaField";

/** The slice of JSON Schema the form understands; anything else falls back to raw JSON. */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  items?: JsonSchema;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

/** Initial form value: the schema's declared `default`s. */
export function seedFromSchema(schema: JsonSchema | null): Record<string, unknown> {
  const seed: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema?.properties ?? {})) {
    if (prop.default !== undefined) seed[key] = prop.default;
  }
  return seed;
}

export function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: JsonSchema | null;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const properties = schema?.properties;
  if (!properties || Object.keys(properties).length === 0) {
    // No usable schema — raw JSON is the form.
    return (
      <JsonArea
        value={value}
        onChange={(v) => {
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            onChange(v as Record<string, unknown>);
          }
        }}
      />
    );
  }
  const required = schema?.required ?? [];
  return (
    <div className="schema-form">
      {Object.entries(properties).map(([name, propSchema]) => (
        <SchemaField
          key={name}
          name={name}
          schema={propSchema}
          required={required.includes(name)}
          value={value[name]}
          onChange={(v) => {
            const next = { ...value };
            if (v === undefined) delete next[name];
            else next[name] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

/** Raw-JSON editor: local text state, propagates only when the JSON parses. */
export function JsonArea({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [invalid, setInvalid] = useState(false);

  // Re-sync when the outside value changes to something we didn't produce.
  useEffect(() => {
    setText((current) => {
      try {
        if (JSON.stringify(JSON.parse(current)) === JSON.stringify(value)) {
          return current;
        }
      } catch {
        // fall through to reset
      }
      setInvalid(false);
      return JSON.stringify(value ?? {}, null, 2);
    });
  }, [value]);

  return (
    <div className="json-area">
      <textarea
        className={invalid ? "code-input invalid" : "code-input"}
        rows={6}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          const nextText = e.target.value;
          setText(nextText);
          try {
            onChange(JSON.parse(nextText));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && <p className="error-text">Not valid JSON — last valid value will be sent.</p>}
    </div>
  );
}
