"use strict";

import { getPreferences, savePreferences } from "../modules/preferences.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  const prefs = await getPreferences();
  const accounts = await browser.accounts.list();

  // Populate Notification toggles
  document.getElementById("notify_summary").checked = prefs.notify_summary;
  document.getElementById("play_sound").checked = prefs.play_sound;

  const tbody = document.getElementById("accounts_tbody");
  tbody.innerHTML = "";

  const rules = prefs.account_rules || {};

  accounts.forEach(acc => {
    // Default to fully enabled if an account is brand new
    const accRules = rules[acc.id] || { enabled: true, clean_junk: true, clean_trash: true, run_compact: true };
    const tr = document.createElement("tr");

    // Cell 1: Master Enable Toggle + Name
    const tdName = document.createElement("td");
    const lblName = document.createElement("label");
    const cbEnabled = document.createElement("input");
    cbEnabled.type = "checkbox";
    cbEnabled.className = "master-enable";
    cbEnabled.dataset.id = acc.id;
    cbEnabled.checked = accRules.enabled;
    const spanName = document.createElement("span");
    spanName.className = "account-name-lbl";
    spanName.textContent = acc.name || `Account (${acc.id})`;
    lblName.appendChild(cbEnabled);
    lblName.appendChild(spanName);
    tdName.appendChild(lblName);

    // Helper function for action checkboxes
    const createActionCell = (actionClass, isChecked) => {
      const td = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = actionClass;
      cb.checked = isChecked;
      if (!accRules.enabled) cb.disabled = true;
      td.appendChild(cb);
      return td;
    };

    const tdJunk = createActionCell("action-junk", accRules.clean_junk);
    const tdTrash = createActionCell("action-trash", accRules.clean_trash);
    const tdCompact = createActionCell("action-compact", accRules.run_compact);

    // Toggle row visibility/usability when master is clicked
    cbEnabled.addEventListener("change", (e) => {
      const state = e.target.checked;
      tdJunk.querySelector("input").disabled = !state;
      tdTrash.querySelector("input").disabled = !state;
      tdCompact.querySelector("input").disabled = !state;
      tr.className = state ? "" : "disabled-row";
    });

    if (!accRules.enabled) tr.className = "disabled-row";

    tr.appendChild(tdName);
    tr.appendChild(tdJunk);
    tr.appendChild(tdTrash);
    tr.appendChild(tdCompact);
    tbody.appendChild(tr);
  });

  // Save handler
  document.getElementById("save_btn").addEventListener("click", async () => {
    const updatedRules = {};
    
    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
      const masterCb = row.querySelector(".master-enable");
      if (masterCb) {
        const accId = masterCb.dataset.id;
        updatedRules[accId] = {
          enabled: masterCb.checked,
          clean_junk: row.querySelector(".action-junk").checked,
          clean_trash: row.querySelector(".action-trash").checked,
          run_compact: row.querySelector(".action-compact").checked
        };
      }
    });

    const updatedPrefs = {
      notify_summary: document.getElementById("notify_summary").checked,
      play_sound: document.getElementById("play_sound").checked,
      account_rules: updatedRules
    };

    await savePreferences(updatedPrefs);

    const status = document.getElementById("status_msg");
    status.textContent = "Saved successfully!";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});