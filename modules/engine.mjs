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
    console.info("PurgeCompact: Summary Result ->", msg);

    // Audio playback directly from extension assets
    let audio = new Audio(browser.runtime.getURL("sounds/notify.mp3"));
    audio.play().catch(err => console.warn("PurgeCompact: Audio playback failed:", err));

    // XPCOM Alert bypass
    if (browser.PurgeCompactAPI && browser.PurgeCompactAPI.showNotification) {
      browser.PurgeCompactAPI.showNotification("PurgeCompact Finished", msg);
    } else {
      // Standard fallback if bridge is unavailable
      browser.notifications.create("purgecompact-summary", {
        type: "basic",
        title: "PurgeCompact Finished",
        message: msg,
        iconUrl: "icons/icon32.png"
      }).catch(() => {});
    }
  } catch (ex) {
    console.error("PurgeCompact: Error displaying summary:", ex);
  }
}

export async function runPurgeCompact() {
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

      for (let folder of account.folders) {
        // Clean Junk
        if (prefs.clean_junk && (folder.type === "junk" || folder.name.toLowerCase() === "junk")) {
          let res = await browser.PurgeCompactAPI.emptyJunk(folder);
          if (res) {
            totalStats.messages += res.messages || 0;
            totalStats.bytes += res.bytes || 0;
          }
        }

        // Clean Trash
        if (prefs.clean_trash && (folder.type === "trash" || folder.name.toLowerCase() === "trash")) {
          let res = await browser.PurgeCompactAPI.emptyTrash(folder);
          if (res) {
            totalStats.messages += res.messages || 0;
            totalStats.bytes += res.bytes || 0;
          }
        }

        // Compact
        if (prefs.run_compact) {
          let res = await browser.PurgeCompactAPI.compactFolder(folder);
          if (res) {
            totalStats.bytes += res.bytes || 0;
          }
        }
      }
    }
  } catch (err) {
    console.error("PurgeCompact: Error during account traversal:", err);
  } finally {
    if (prefs.notify_summary) {
      displaySummary(totalStats);
    }
  }

  return totalStats;
}