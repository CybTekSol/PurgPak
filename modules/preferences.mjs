"use strict";

const DEFAULT_PREFERENCES = {
  notify_summary: true,
  play_sound: true,
  account_rules: {} // Keyed by account id: { "account1": { enabled: true, clean_junk: true, clean_trash: true, run_compact: true } }
};

export async function getPreferences() {
  let stored = await browser.storage.local.get("preferences");
  let prefs = stored.preferences || {};

  // MIGRATION LOGIC: Convert old v1.4.2 global settings to the new per-account structure
  if (prefs.target_accounts !== undefined) {
    let migratedRules = {};
    let globalJunk = prefs.clean_junk !== false;
    let globalTrash = prefs.clean_trash !== false;
    let globalCompact = prefs.run_compact !== false;
    
    // Fetch accounts to build the new structure
    let accounts = await browser.accounts.list();
    let allIds = accounts.map(a => a.id);
    let targets = (prefs.target_accounts.length > 0) ? prefs.target_accounts : allIds;

    for (let accId of allIds) {
      migratedRules[accId] = {
        enabled: targets.includes(accId),
        clean_junk: globalJunk,
        clean_trash: globalTrash,
        run_compact: globalCompact
      };
    }
    
    prefs.account_rules = migratedRules;
    
    // Clean up deprecated global keys
    delete prefs.clean_junk;
    delete prefs.clean_trash;
    delete prefs.run_compact;
    delete prefs.target_accounts;
    delete prefs.confirm_before_run;
    
    // Save migrated state immediately so it only runs once
    await browser.storage.local.set({ preferences: prefs });
  }

  return Object.assign({}, DEFAULT_PREFERENCES, prefs);
}

export async function savePreferences(prefs) {
  await browser.storage.local.set({ preferences: prefs });
}