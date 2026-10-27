"use strict";

import { runPurgPak, runPurgPakTarget } from "./modules/engine.mjs";

console.warn("PurgPak [v1.7.0]: background.js module loaded and active.");

if (browser.browserAction && browser.browserAction.onClicked) {
  browser.browserAction.onClicked.addListener(async () => {
    console.warn("PurgPak [v1.7.0]: Toolbar button clicked -> starting runPurgPak().");
    try {
      await runPurgPak();
    } catch (err) {
      console.error("PurgPak [v1.7.0]: Toolbar execution error:", err);
    }
  });
}

async function setupMenus() {
  if (!browser.menus) {
    console.warn("PurgPak [v1.7.0]: browser.menus API not available.");
    return;
  }

  try {
    await browser.menus.removeAll();

    browser.menus.create({
      id: "purgpak-tools-menu",
      title: "Run PurgPak (All Enabled Accounts)",
      contexts: ["tools_menu"]
    });

    browser.menus.create({
      id: "purgpak-folder-context",
      title: "Compact folders with PurgPak",
      contexts: ["folder_pane"]
    });

    console.warn("PurgPak [v1.7.0]: Tools menu and Folder Pane context menu registered.");
  } catch (err) {
    console.error("PurgPak [v1.7.0]: Error setting up menus:", err);
  }
}

if (browser.menus && browser.menus.onClicked) {
  browser.menus.onClicked.addListener(async (info) => {
    try {
      if (info.menuItemId === "purgpak-tools-menu") {
        console.warn("PurgPak [v1.7.0]: Tools menu item clicked -> starting runPurgPak().");
        await runPurgPak();
      } else if (info.menuItemId === "purgpak-folder-context") {
        console.warn("PurgPak [v1.7.0]: Folder Pane context menu clicked -> starting runPurgPakTarget().");
        await runPurgPakTarget({
          selectedFolder: info.selectedFolder || null,
          selectedAccount: info.selectedAccount || null
        });
      }
    } catch (err) {
      console.error("PurgPak [v1.7.0]: Menu click execution error:", err);
    }
  });
}

setupMenus();