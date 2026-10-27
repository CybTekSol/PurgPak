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

async function processTargetRoot(targetPayload, rules, totalStats, forceCompact = false) {
  let purgedAny = false;

  // 1. Clean all Junk folders inside target (via XPCOM descendants & native flags)
  if (rules.clean_junk) {
    let res = await browser.PurgPakAPI.emptyJunk(targetPayload);
    if (res) {
      if (res.messages > 0) purgedAny = true;
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // 2. Clean all Trash folders inside target (via XPCOM descendants & native flags)
  if (rules.clean_trash) {
    let res = await browser.PurgPakAPI.emptyTrash(targetPayload);
    if (res) {
      if (res.messages > 0) purgedAny = true;
      totalStats.messages += res.messages || 0;
      totalStats.bytes += res.bytes || 0;
    }
  }

  // 3. Expunge & Compact all folders inside target
  if (rules.run_compact) {
    let compactPayload = Object.assign({}, targetPayload, {
      _forceCompact: (forceCompact || purgedAny)
    });
    let res = await browser.PurgPakAPI.compactFolder(compactPayload);
    if (res) {
      totalStats.bytes += res.bytes || 0;
    }
  }
}

export async function runPurgPak() {
  const prefs = await getPreferences();
  let accounts = await browser.accounts.list(false);

  let totalStats = { messages: 0, bytes: 0 };
  let rules = prefs.account_rules || {};

  try {
    for (let account of accounts) {
      let accRules = rules[account.id] || { enabled: true, clean_junk: true, clean_trash: true, run_compact: true };
      if (!accRules.enabled) continue;

      let accountRootPayload = {
        accountId: account.id,
        path: "/",
        _scanAll: true
      };

      await processTargetRoot(accountRootPayload, accRules, totalStats, false);
    }
  } catch (err) {
    console.error("PurgPak: Error during account traversal:", err);
  } finally {
    displaySummary(totalStats, prefs);
  }

  return totalStats;
}

export async function runPurgPakTarget(target) {
  const prefs = await getPreferences();
  let totalStats = { messages: 0, bytes: 0 };
  let rules = prefs.account_rules || {};

  try {
    if (target.selectedFolder) {
      let folder = target.selectedFolder;
      let accRules = rules[folder.accountId] || { enabled: true, clean_junk: true, clean_trash: true, run_compact: true };
      let folderPayload = Object.assign({}, folder, { _scanAll: true });
      await processTargetRoot(folderPayload, accRules, totalStats, true);
    } else if (target.selectedAccount) {
      let accountId = target.selectedAccount.id;
      let accRules = rules[accountId] || { enabled: true, clean_junk: true, clean_trash: true, run_compact: true };
      let accountRootPayload = {
        accountId: accountId,
        path: "/",
        _scanAll: true
      };
      await processTargetRoot(accountRootPayload, accRules, totalStats, true);
    }
  } catch (err) {
    console.error("PurgPak: Error during targeted execution:", err);
  } finally {
    displaySummary(totalStats, prefs);
  }

  return totalStats;
}