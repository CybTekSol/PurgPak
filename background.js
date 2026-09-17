"use strict";

import { runPurgeCompact } from "./modules/engine.mjs";

browser.browserAction.onClicked.addListener(async () => {
  console.info("PurgeCompact: Execution initiated by user.");
  try {
    await runPurgeCompact();
  } catch (err) {
    console.error("PurgeCompact: Execution failed:", err);
  }
});