# PurgPak (formerly PurgeCompact)

**PurgPak** is an open-source Thunderbird MailExtension designed to quickly empty Junk, purge Trash, and compact message folders across multiple accounts in a single pass—with real-time disk recovery statistics.

Developed and maintained by **CybTekSol [ https://github.com/CybTekSol ]** as a modern, lightweight successor to legacy account-cleaning utilities.

---

## Important Notice & Support Policy

> **DISCLAIMER:**  
> This extension is provided **AS-IS**, free of charge, under the GNU General Public License v3.0 (GPL-3.0).  
>
> Because Thunderbird does not provide native WebExtension APIs for physical database compacting, PurgPak relies on internal Mozilla XPCOM / Experiment APIs. Major Thunderbird ESR upgrades frequently alter internal Mozilla modules and may temporarily break functionality.
>
> **Maintenance is best-effort.** The codebase is structured using a hardened "Thin Bridge" pattern to minimize maintenance overhead. Community bug reports, feedback, and Pull Requests are welcome.

---

## Features

- **Multi-Account Processing:** Empty junk, spam, trash, and compact multiple accounts or select folders simultaneously.
- **Efficiency Checks:** Evaluates `expungedBytes` before compacting, skipping folders that don't require maintenance to save unnecessary SSD write cycles.
- **Accurate Recovery Stats:** Utilizes asynchronous `nsIUrlListener` hooks to pause and accurately calculate the exact physical disk space freed after native C++ disk writes complete.
- **Resilient Notification Delivery:** Bypasses OS-level Action Center quirks (like those in Windows 10 IoT LTSC or lightweight Linux DEs) by drawing visual summaries directly into Thunderbird's native `mail:3pane` notification bar.
- **Audio Feedback:** Includes a custom HTML5 audio chime on completion, which can be independently toggled on or off in the extension settings.

---

## Compatibility

* **Thunderbird Version:** 128.0 and Newer
* **OS Tested:** Windows 10/11 (including IoT Enterprise / LTSC), Linux (LMDE7, Arch/EndeavourOS), macOS.

---

## Architecture: The "Thin Bridge"

PurgPak utilizes a hybrid "Thin Bridge" pattern to survive Thunderbird's rapid release cycle. The UI, options, and audio logic exist safely within sandboxed WebExtension ES modules, while low-level folder operations (`emptyTrash`, `emptyJunk`, `compactFolder`) are executed via a minimal, self-healing XPCOM experiment (`implementation.js`). 

---

## Installation

### Manual Install (.xpi)
1. Download the latest `PurgPak-v1.4.2.xpi` from the [Releases](https://github.com/CybTekSol/PurgPak/releases) section.
2. In Thunderbird, open **Tools > Add-ons and Themes** (or press `Ctrl + Shift + A`).
3. Click the gear icon in the top right and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file and confirm installation.

> **Note for Windows IoT / LTSC & Linux Desktop Users:** 
> As of version 1.4.0, manual `user.js` configurations (such as modifying `alerts.useSystemBackend`) are **no longer required**. PurgPak now completely bypasses the OS notification daemon and renders its summaries natively inside the Thunderbird application window.

---

## Configuration Settings

1. In Thunderbird, open **Tools > Add-ons and Themes** (or press `Ctrl + Shift + A`).
2. Scroll to find PurgPak in the list of Add-ons.
3. Click the "Wrench" icon on the right-side of the PurgPak entry in the list to access PurgPak's currently available "Options".
4. ALL available settings for accounts and functions are controlled by "ticking" or "unticking" their respective toggle box.
5. ENJOY your reclaimed time and disk space!

---

## Changelog

### Changes in version 1.4.2:
* Added an independent **Show summary notification upon completion** toggle and an independent **Play notification sound upon completion** toggle in the PurgPak Configuration settings at user request, allowing users to mute the completion chime while keeping visual summary banners active (or vice versa) or to enable/disable both.

### Changes in version 1.4.1:
* The Toolbar Button has been changed to simply "PurgPak" instead of "Run PurgPak" at user BY-Joe's request. Code remains unaltered.

---

## License

Licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) (GPL-3.0).