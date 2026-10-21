"use strict";

import { runPurgPak, runPurgPakTarget } from "./modules/engine.mjs";

// Create Tools menu and Folder Pane right-click menu entries
async function setupMenus() {
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
  } catch (err) {
    console.error("PurgPak: Error creating menu items:", err);
  }
}

setupMenus();

// Toolbar button listener
browser.browserAction.onClicked.addListener(async () => {
  try {
    await runPurgPak();
  } catch (err) {
    console.error("PurgPak: Execution failed:", err);
  }
});

// Menu click listener (Tools menu & Right-click Folder Pane)
browser.menus.onClicked.addListener(async (info) => {
  try {
    if (info.menuItemId === "purgpak-tools-menu") {
      await runPurgPak();
    } else if (info.menuItemId === "purgpak-folder-context") {
      await runPurgPakTarget({
        selectedFolder: info.selectedFolder || null,
        selectedAccount: info.selectedAccount || null
      });
    }
  } catch (err) {
    console.error("PurgPak: Menu execution failed:", err);
  }
});