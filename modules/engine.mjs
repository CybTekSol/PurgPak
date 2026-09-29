"use strict";

import { getPreferences } from "./preferences.mjs";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return "0 Bytes";
  const k = 1024, dm = 2;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function displaySummary(stats, prefs) {
  try {
    const msg = `Purged ${(stats.messages)} messages.\nRecovered ${(formatBytes(stats.bytes))} of disk space.`;

    if (prefs.play_sound) {
      let audio = new Audio(browser.runtime.getURL("sounds/notify.mp3"));
      audio.play().catch(err => console.warn("PurgPak: Audio playback failed:", err));
    }

    if (prefs.notify_summary) {
      if (browser.PurgPakAPI && browser.PurgPakAPI.showNotification) {
        browser.PurgPakAPI.showNotification("PurgPak Finished", msg);
      } else {
        browser.notifications.create("purgpak-summary", {
          type: "basic", title: "PurgPak Finished", message: msg, iconUrl: "icons/icon-32.png"
        }).catch(() => {});
      }
    }
  } catch (ex) {
    console.error("PurgPak: Error displaying summary:", ex);
  }
}

async function processFolder(folder, rules, totalStats) {
  let isJunk = (folder.type === "junk" || folder.name.toLowerCase() === "junk" || folder.name.toLowerCase() === "spam");
  let isTrash = (folder.type === "trash" || folder.name.toLowerCase() === "trash");

  // Clean Junk
  if (rules.clean_junk && isJunk) {
    let res = await browser.PurgPakAPI.emptyJunk(folder);
    if (res) {
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // Clean Trash
  if (rules.clean_trash && isTrash) {
    let res = await browser.PurgPakAPI.emptyTrash(folder);
    if (res) {
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // Compact
  if (rules.run_compact) {
    let res = await browser.PurgPakAPI.compactFolder(folder);
    if (res) {
      totalStats.bytes += res.bytes || 0;
    }
  }

  // Recursion
  if (folder.subFolders && folder.subFolders.length > 0) {
    for (let sub of folder.subFolders) {
      await processFolder(sub, rules, totalStats);
    }
  }
}

export async function runPurgPak() {
  const prefs = await getPreferences();
  let accounts = await browser.accounts.list();

  let totalStats = { messages: 0, bytes: 0 };
  let rules = prefs.account_rules || {};

  try {
    for (let account of accounts) {
      // Bulletproof fallback to ensure undefined values evaluate to true
      let accRules = rules[account.id] || { enabled: true, clean_junk: true, clean_trash: true, run_compact: true };

      if (!accRules.enabled) continue;

      if (!account.folders) continue;

      for (let rootFolder of account.folders) {
        await processFolder(rootFolder, accRules, totalStats);
      }
    }
  } catch (err) {
    console.error("PurgPak: Error during account traversal:", err);
  } finally {
    displaySummary(totalStats, prefs);
  }

  return totalStats;
}