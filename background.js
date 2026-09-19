"use strict";

import { runPurgPak } from "./modules/engine.mjs";

browser.browserAction.onClicked.addListener(async () => {
  console.info("PurgPak: Execution initiated by user.");
  try {
    await runPurgPak();
  } catch (err) {
    console.error("PurgPak: Execution failed:", err);
  }
});