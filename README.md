[README.md](https://github.com/user-attachments/files/32311726/README.md)
# PurgeCompact

**PurgeCompact** is an open-source Thunderbird MailExtension designed to quickly empty Junk, purge Trash, and compact message folders across multiple accounts in a single pass—with real-time disk recovery statistics.

Developed and maintained by **CybTekSol** as a modern, lightweight successor to legacy account-cleaning utilities.

---

## Important Notice & Support Policy

> **DISCLAIMER:**  
> This extension is provided **as-is**, free of charge, under the GNU General Public License v3.0 (GPL-3.0).  
>
> Because Thunderbird does not provide native WebExtension APIs for physical database compacting, PurgeCompact relies on internal Mozilla XPCOM / Experiment APIs. Major Thunderbird ESR upgrades frequently alter internal Mozilla modules and may temporarily break functionality.
>
> **Maintenance is best-effort.** The codebase is structured using a hardened "Thin Bridge" pattern to minimize maintenance overhead. Community bug reports, feedback, and Pull Requests are welcome.

---

## Features

- **Multi-Account Processing:** Empty junk, trash, and compact multiple accounts or select folders simultaneously.
- **Efficiency Checks:** Evaluates `expungedBytes` before compacting, skipping folders that don't require maintenance to save unnecessary SSD write cycles.
- **Accurate Recovery Stats:** Utilizes asynchronous `nsIUrlListener` hooks to pause and accurately calculate the exact physical disk space freed after native C++ disk writes complete.
- **Resilient Notification Delivery:** Bypasses OS-level Action Center quirks (like those in Windows 10 IoT LTSC or lightweight Linux DEs) by drawing visual summaries directly into Thunderbird's native `mail:3pane` notification bar.
- **Audio Feedback:** Includes a custom HTML5 audio chime on completion.

---

## Compatibility

* **Thunderbird Version:** 128.0 to 156.*
* **OS Tested:** Windows 10/11 (including IoT Enterprise / LTSC), Linux (LMDE7, Arch/EndeavourOS), macOS.

---

## Architecture: The "Thin Bridge"

PurgeCompact utilizes a hybrid "Thin Bridge" pattern to survive Thunderbird's rapid release cycle. The UI, options, and audio logic exist safely within sandboxed WebExtension ES modules, while low-level folder operations (`emptyTrash`, `emptyJunk`, `compactFolder`) are executed via a minimal, self-healing XPCOM experiment (`implementation.js`). 

---

## Installation

### Manual Install (.xpi)
1. Download the latest `PurgeCompact-v1.3.0.xpi` from the [Releases](https://github.com/CybTekSol/PurgeCompact/releases) section.
2. In Thunderbird, open **Tools > Add-ons and Themes** (or press `Ctrl + Shift + A`).
3. Click the gear icon in the top right and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file and confirm installation.

> **Note for Windows IoT / LTSC & Linux Desktop Users:** 
> As of version 1.3.0, manual `user.js` configurations (such as modifying `alerts.useSystemBackend`) are **no longer required**. PurgeCompact now completely bypasses the OS notification daemon and renders its summaries natively inside the Thunderbird application window.

---

## License

Licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) (GPL-3.0).
