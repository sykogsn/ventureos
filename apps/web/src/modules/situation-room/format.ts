export function formatBriefingDate(date: Date, locale = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function attentionLabel(attention: "today" | "this-week" | "hold") {
  if (attention === "today") return "Today";
  if (attention === "this-week") return "This week";
  return "Hold";
}
