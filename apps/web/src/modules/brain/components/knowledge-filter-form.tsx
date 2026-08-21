import type { KnowledgeFilter } from "@/platform/brain";
import { BRAIN_VENTURE_SCOPES, KNOWLEDGE_STATUSES, KNOWLEDGE_TYPES, listOwners } from "@/platform/brain";

function Field({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly string[];
}) {
  return (
    <label className="ids-label flex min-w-[10rem] flex-1 flex-col gap-2">
      {label}
      <select name={name} defaultValue={value} className="vos-field">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function KnowledgeFilterForm({ filter }: { filter: KnowledgeFilter }) {
  return (
    <form method="get" className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <Field label="Type" name="type" value={filter.type ?? ""} options={KNOWLEDGE_TYPES} />
        <Field label="Owner" name="owner" value={filter.owner ?? ""} options={listOwners()} />
        <Field label="Status" name="status" value={filter.status ?? ""} options={KNOWLEDGE_STATUSES} />
        <Field
          label="Venture"
          name="venture"
          value={filter.venture ?? ""}
          options={BRAIN_VENTURE_SCOPES}
        />
      </div>
      <label className="ids-label flex max-w-xl flex-col gap-2">
        Search
        <input
          className="vos-field"
          type="search"
          name="q"
          defaultValue={filter.q ?? ""}
          placeholder="Title or summary"
        />
      </label>
      <div>
        <button type="submit" className="vos-btn-secondary">
          Apply
        </button>
      </div>
    </form>
  );
}
