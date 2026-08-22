import { Hairline, ReadingRegion, Stack } from "@/core/layout";

function headingClass(level: number) {
  if (level <= 1) {
    return "ids-heading";
  }
  if (level === 2) {
    return "ids-label text-foreground";
  }
  return "ids-kicker";
}

export function RecordMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);

  return (
    <ReadingRegion size="lg">
      <Stack gap="compact">
        {blocks.map((block, index) => {
          const trimmed = block.trim();
          if (!trimmed || trimmed === "---") {
            return (
              <Hairline key={index} space="compact">
                <span />
              </Hairline>
            );
          }

          const heading = trimmed.match(/^(#{1,3})\s+(.+)$/s);
          if (heading?.[1] && heading[2]) {
            const Tag = heading[1].length === 1 ? "h2" : "h3";
            return (
              <Tag key={index} className={headingClass(heading[1].length)}>
                {heading[2].replace(/\n/g, " ")}
              </Tag>
            );
          }

          if (trimmed.startsWith("|")) {
            return (
              <p key={index} className="ids-caption">
                {trimmed.replace(/\|/g, " · ").replace(/^ · | · $/g, "")}
              </p>
            );
          }

          return (
            <p key={index} className="ids-body text-muted">
              {trimmed.replace(/\*\*/g, "")}
            </p>
          );
        })}
      </Stack>
    </ReadingRegion>
  );
}
