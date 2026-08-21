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
    <form method="get" action={action} className="flex max-w-xl flex-col gap-3">
      <label className="ids-label flex flex-col gap-2">
        {label}
        <input
          className="vos-field"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      </label>
      <div>
        <button type="submit" className="vos-btn-secondary">
          Search
        </button>
      </div>
    </form>
  );
}
