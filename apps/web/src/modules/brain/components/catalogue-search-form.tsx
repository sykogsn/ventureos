import { Field, Form, ReadingRegion } from "@/core/layout";

export function CatalogueSearchForm({
  action,
  defaultValue,
  label = "Search",
  placeholder,
}: {
  action: string;
  defaultValue: string;
  label?: string;
  placeholder: string;
}) {
  return (
    <ReadingRegion size="lg">
      <Form gap="compact" method="get" action={action}>
        <Field>
          {label}
          <input
            className="vos-field"
            type="search"
            name="q"
            defaultValue={defaultValue}
            placeholder={placeholder}
          />
        </Field>
        <div>
          <button type="submit" className="vos-btn-secondary">
            Search
          </button>
        </div>
      </Form>
    </ReadingRegion>
  );
}
