"use strict";

import { getPreferences } from "./preferences.mjs";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return "0 Bytes";
  const k = 1024, dm = 2;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function displaySummary(stats) {
  try {
    const msg = `Purged ${stats.messages} messages.\nRecovered ${formatBytes(stats.bytes)} of disk space.`;
    console.info("PurgPak: Summary Result ->", msg);

    // Audio playback directly from extension assets
    let audio = new Audio(browser.runtime.getURL("sounds/notify.mp3"));
    audio.play().catch(err => console.warn("PurgPak: Audio playback failed:", err));

    // XPCOM Alert bypass
    if (browser.PurgPakAPI && browser.PurgPakAPI.showNotification) {
      browser.PurgPakAPI.showNotification("PurgPak Finished", msg);
    } else {
      // Standard fallback if bridge is unavailable
      browser.notifications.create("purgpak-summary", {
        type: "basic",
        title: "PurgPak Finished",
        message: msg,
        iconUrl: "icons/icon-32.png"
      }).catch(() => {});
    }
  } catch (ex) {
    console.error("PurgPak: Error displaying summary:", ex);
  }
}

// Recursive function to dig into all subfolders
async function processFolder(folder, prefs, totalStats) {
console.info(`EVALUATING FOLDER: "${folder.name}" | TYPE: "${folder.type}" | PATH: "${folder.path}"`);
  // Clean Junk
  if (prefs.clean_junk && (folder.type === "junk" || folder.name.toLowerCase() === "junk" || folder.name.toLowerCase() === "spam")) {
    let res = await browser.PurgPakAPI.emptyJunk(folder);
    if (res) {
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // Clean Trash
  if (prefs.clean_trash && (folder.type === "trash" || folder.name.toLowerCase() === "trash")) {
    let res = await browser.PurgPakAPI.emptyTrash(folder);
    if (res) {
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // Compact
  if (prefs.run_compact) {
    let res = await browser.PurgPakAPI.compactFolder(folder);
    if (res) {
      totalStats.bytes += res.bytes || 0;
    }
  }

  // If this folder has subfolders, recursively process them
  if (folder.subFolders && folder.subFolders.length > 0) {
    for (let sub of folder.subFolders) {
      await processFolder(sub, prefs, totalStats);
    }
  }
}

export async function runPurgPak() {
  const prefs = await getPreferences();
  let accounts = await browser.accounts.list();

  let targets = accounts;
  if (prefs.target_accounts && prefs.target_accounts.length > 0) {
    targets = accounts.filter(acc => prefs.target_accounts.includes(acc.id));
  }

  let totalStats = { messages: 0, bytes: 0 };

  try {
    for (let account of targets) {
      if (!account.folders) continue;

      for (let rootFolder of account.folders) {
        // Pass the root folder into the recursive loop
        await processFolder(rootFolder, prefs, totalStats);
      }
    }
  } catch (err) {
    console.error("PurgPak: Error during account traversal:", err);
  } finally {
    if (prefs.notify_summary) {
      displaySummary(totalStats);
    }
  }

  return totalStats;
}