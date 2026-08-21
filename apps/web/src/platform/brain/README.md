# Brain

Platform institutional knowledge. Presentation reads this in-memory catalogue. It is not persistence, not a document manager, and not a second Runtime.

## Knowledge Object

Every Brain document is one `KnowledgeObject`. Type is a discriminant (`Constitution`, `Standard`, `Architecture`, `Blueprint`, `Research`, `Playbook`, `Policy`, `Roadmap`, `Decision`). It is not a second schema.

Required layout fields: Title, Summary, Purpose, Why, Evidence, Relationships, History, Owner, Status, Review Date, AI Context.

Relationships are ids of other Knowledge Objects. Governance cards and the Decision Register are views over the same catalogue. Decision records add `impact`, `alternatives`, and `issuedAt` on the same object; they are not stored beside it.

`assertKnowledgeCatalogue` fails if a type is missing or a relationship id does not resolve.

`query.ts` filters and substring-searches. Do not add embeddings or graph queries here.
