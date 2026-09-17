"use strict";

import { getPreferences, savePreferences } from "../modules/preferences.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  const prefs = await getPreferences();
  const accounts = await browser.accounts.list();

  // Populate basic toggles
  document.getElementById("clean_junk").checked = prefs.clean_junk;
  document.getElementById("clean_trash").checked = prefs.clean_trash;
  document.getElementById("run_compact").checked = prefs.run_compact;
  document.getElementById("notify_summary").checked = prefs.notify_summary;

  // Render accounts list
  const container = document.getElementById("accounts_container");
  container.innerHTML = "";

  accounts.forEach(acc => {
    const label = document.createElement("label");
    label.className = "toggle-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = acc.id;
    // Default to checked if array is empty or specifically included
    input.checked = (prefs.target_accounts.length === 0) || prefs.target_accounts.includes(acc.id);

    const span = document.createElement("span");
    span.textContent = acc.name || `Account (${acc.id})`;

    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });

  // Save handler
  document.getElementById("save_btn").addEventListener("click", async () => {
    const selectedAccounts = [];
    container.querySelectorAll("input[type='checkbox']:checked").forEach(box => {
      selectedAccounts.push(box.value);
    });

    const updated = {
      clean_junk: document.getElementById("clean_junk").checked,
      clean_trash: document.getElementById("clean_trash").checked,
      run_compact: document.getElementById("run_compact").checked,
      notify_summary: document.getElementById("notify_summary").checked,
      target_accounts: selectedAccounts
    };

    await savePreferences(updated);

    const status = document.getElementById("status_msg");
    status.textContent = "Saved successfully!";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});