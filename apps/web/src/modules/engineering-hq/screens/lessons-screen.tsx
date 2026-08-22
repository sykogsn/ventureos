import { Field, Form, ReadingRegion, Stack, StackList } from "@/core/layout";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { EngineeringCatalogue } from "../types";
import { EngineeringFrame } from "../components/engineering-frame";

export function EngineeringLessonsScreen({
  catalogue,
  sprintQuery,
  categoryQuery,
}: {
  catalogue: EngineeringCatalogue;
  sprintQuery: string;
  categoryQuery: string;
}) {
  const items = catalogue.lessons.filter((item) => {
    const sprintOk =
      sprintQuery.length === 0 ||
      item.sprint.toLowerCase().includes(sprintQuery.toLowerCase());
    const categoryOk =
      categoryQuery.length === 0 ||
      item.category.toLowerCase().includes(categoryQuery.toLowerCase());
    return sprintOk && categoryOk;
  });

  return (
    <EngineeringFrame
      page="Lessons"
      title="Lessons Learned"
      description="Journal parsed from LESSONS_LEARNED.md. Filter now; the same fields will serve later search."
    >
      <ReadingRegion size="lg">
        <Form gap="compact" method="get" action="/engineering/lessons">
          <Field>
            Sprint
            <input
              className="vos-field"
              type="search"
              name="sprint"
              defaultValue={sprintQuery}
              placeholder="VS-007"
            />
          </Field>
          <Field>
            Category
            <input
              className="vos-field"
              type="search"
              name="category"
              defaultValue={categoryQuery}
              placeholder="Foundation recovery"
            />
          </Field>
          <div>
            <button type="submit" className="vos-btn-secondary">
              Filter
            </button>
          </div>
        </Form>
      </ReadingRegion>
      {items.length === 0 ? (
        <EmptyCopy title="No lessons match">
          Clear the filter or add a lesson to the journal after the next sprint.
        </EmptyCopy>
      ) : (
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <p className="ids-caption">
                  {item.id} · {item.sprint} · {item.date} · {item.category}
                </p>
                <h2 className="ids-label text-foreground">{item.title}</h2>
                <p className="ids-body text-muted">{item.body}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </EngineeringFrame>
  );
}
