import type { CompanyStory } from "./types";

export function createCompanyStory(input: CompanyStory): CompanyStory {
  return { ...input };
}

export function storyHighlight(story: CompanyStory) {
  return {
    chapter: story.chapter,
    excerpt: story.excerpt,
    tension: story.tension,
  };
}
