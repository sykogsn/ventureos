import type { KnowledgeFilter } from "@/platform/brain";
import { BRAIN_VENTURE_SCOPES, KNOWLEDGE_STATUSES, KNOWLEDGE_TYPES, listOwners } from "@/platform/brain";
import { Field, Form, Grid, ReadingRegion } from "@/core/layout";

function FilterSelect({
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
    <Field>
      {label}
      <select name={name} defaultValue={value} className="vos-field">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function KnowledgeFilterForm({ filter }: { filter: KnowledgeFilter }) {
  return (
    <Form gap="compact" method="get">
      <Grid variant="analytics">
        <FilterSelect label="Type" name="type" value={filter.type ?? ""} options={KNOWLEDGE_TYPES} />
        <FilterSelect label="Owner" name="owner" value={filter.owner ?? ""} options={listOwners()} />
        <FilterSelect label="Status" name="status" value={filter.status ?? ""} options={KNOWLEDGE_STATUSES} />
        <FilterSelect
          label="Venture"
          name="venture"
          value={filter.venture ?? ""}
          options={BRAIN_VENTURE_SCOPES}
        />
      </Grid>
      <ReadingRegion size="lg">
        <Field>
          Search
          <input
            className="vos-field"
            type="search"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Title or summary"
          />
        </Field>
      </ReadingRegion>
      <div>
        <button type="submit" className="vos-btn-secondary">
          Apply
        </button>
      </div>
    </Form>
  );
}
