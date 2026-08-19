# Executive Intelligence Runtime

The only intelligence orchestration entry is `runExecutiveIntelligenceRuntime`.

Call graph (`RUNTIME_PIPELINE`):

1. `resolve-capabilities` — `assertRuntimeCapabilities`
2. `enforce-instance-profiles` — `assertRuntimeInstanceUsage`
3. `apply-event` — `applyRuntimeEvent` (venture, decisions, executive memory, company story)
4. `policy-evaluation` — `hydratePolicyEngine` (policy findings are this stage's output)
5. `recommendation-engine` — `hydrateRecommendations` (executive briefing is assembled here)
6. `operating-health` — `refreshOperatingHealth`
7. `knowledge-graph` — `refreshKnowledgeGraph`

Memory and story are not separate Runtime stages. Persist is not a Runtime stage; the intelligence service writes repositories after mutation snapshots only.
