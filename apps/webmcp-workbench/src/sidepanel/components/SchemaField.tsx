import type { ReactNode } from "react";
import { JsonArea, SchemaForm, type JsonSchema } from "./SchemaForm";

/** One field of the schema-driven form, dispatched on `schema.type`. */
export function SchemaField({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const label = (
    <span className="field-label">
      {name}
      {required && <span className="required" title="required">*</span>}
    </span>
  );
  const help = schema.description && (
    <span className="field-help">{schema.description}</span>
  );

  let control: ReactNode;
  switch (schema.type) {
    case "string":
      control = Array.isArray(schema.enum) ? (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">(unset)</option>
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      );
      break;
    case "number":
    case "integer":
      control = (
        <input
          type="number"
          step={schema.type === "integer" ? 1 : "any"}
          min={schema.minimum}
          max={schema.maximum}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => {
            if (e.target.value === "") return onChange(undefined);
            const num =
              schema.type === "integer"
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value);
            onChange(Number.isNaN(num) ? undefined : num);
          }}
        />
      );
      break;
    case "boolean":
      control = (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
      break;
    case "array": {
      const items = Array.isArray(value) ? value : [];
      const itemSchema = schema.items ?? {};
      control = (
        <div className="array-field">
          {items.map((item, i) => (
            <div className="array-row" key={i}>
              <SchemaField
                name={`${i}`}
                schema={itemSchema}
                required={false}
                value={item}
                onChange={(v) => {
                  const next = [...items];
                  next[i] = v;
                  onChange(next);
                }}
              />
              <button
                className="icon-btn"
                title="Remove item"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="add-btn" onClick={() => onChange([...items, undefined])}>
            + Add item
          </button>
        </div>
      );
      break;
    }
    case "object":
      if (schema.properties) {
        control = (
          <div className="nested-object">
            <SchemaForm
              schema={schema}
              value={
                typeof value === "object" && value !== null && !Array.isArray(value)
                  ? (value as Record<string, unknown>)
                  : {}
              }
              onChange={onChange}
            />
          </div>
        );
        break;
      }
    // fall through: object without properties → raw JSON
    default:
      control = <JsonArea value={value} onChange={onChange} />;
  }

  return (
    <label className="field">
      {label}
      {help}
      {control}
    </label>
  );
}
