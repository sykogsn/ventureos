import {
  recoverStaleDevServer,
  webRootFrom,
} from "./ids-dev-guard";

const recovered = recoverStaleDevServer(webRootFrom());
if (recovered.length === 0) {
  console.log("IDS recovery: no stale Next.js lock or port-3000 listener.");
} else {
  console.log(`IDS recovery:\n- ${recovered.join("\n- ")}`);
}
