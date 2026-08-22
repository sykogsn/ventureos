import {
  assertIdsSourceGraph,
  idsRootFromWeb,
  runIdsGenerate,
  webRootFrom,
} from "./ids-dev-guard";

const webRoot = webRootFrom();
const idsRoot = idsRootFromWeb(webRoot);

try {
  runIdsGenerate(idsRoot);
  assertIdsSourceGraph(webRoot, idsRoot);
  console.log("Doctor: IDS generate, source graph, and token check passed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Doctor failed.\n${message}`);
  process.exit(1);
}
