"use strict";

const DEFAULT_PREFERENCES = {
  confirm_before_run: false,
  notify_summary: true,
  clean_junk: true,
  clean_trash: true,
  run_compact: true,
  target_accounts: [] // list of account IDs
};

export async function getPreferences() {
  let stored = await browser.storage.local.get("preferences");
  return Object.assign({}, DEFAULT_PREFERENCES, stored.preferences || {});
}

export async function savePreferences(prefs) {
  await browser.storage.local.set({ preferences: prefs });
}