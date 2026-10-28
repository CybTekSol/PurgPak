# PurgPak (formerly PurgeCompact)

**PurgPak** is an open-source Thunderbird MailExtension designed to quickly empty Junk, purge Trash, and compact message folders across multiple accounts in a single pass—with real-time disk recovery statistics.

Developed and maintained by **CybTekSol [ https://github.com/CybTekSol ]** as a modern, lightweight successor to legacy account-cleaning utilities.

---

## Important Notice & Support Policy

> **DISCLAIMER:**  
> This extension is provided free of charge, **AS-IS**, no warranties or guarantees (expressed or implied)... use is at your own risk and is licensed as stated in the LICENSE file located in this repository.  
>
> Because Thunderbird does not provide native WebExtension APIs for physical database compacting, PurgPak relies on internal Mozilla XPCOM / Experiment APIs. Major Thunderbird ESR upgrades frequently alter internal Mozilla modules and may temporarily break functionality.
>
> **Maintenance is best-effort.** The codebase is structured using a hardened "Thin Bridge" pattern to minimize maintenance overhead. Community bug reports, feedback, and Pull Requests are welcome.

---

## Features

- **Multi-Account & Unified Folder Processing:** Empty junk, spam, trash, and compact multiple accounts, Unified Folders (`smart mailboxes`), or select folders simultaneously.

- **Deep XPCOM Folder Traversal:** Uses native `rootFolder.descendants` and `nsMsgFolderFlags` bitmask inspection to seamlessly pierce `INBOX.` IMAP namespaces and localized folder structures (such as GMX and European IMAP providers).

- **Explicit IMAP Expunge & Efficiency Checks:** Evaluates `expungedBytes` and scans for `ImapDeleted` (strikethrough) message flags—issuing explicit IMAP `expunge` and `compact` operations where needed while skipping clean local folders to save SSD write cycles.

- **Accurate Recovery Stats:** Utilizes asynchronous `nsIUrlListener` and `nsIMsgCopyServiceListener` hooks to pause and accurately calculate the exact physical disk space freed after native C++ disk writes and server operations complete.

- **Resilient Notification Delivery:** Bypasses OS-level Action Center quirks (like those in Windows 10 IoT LTSC or lightweight Linux DEs) by drawing visual summaries directly into Thunderbird's native `mail:3pane` notification bar.

- **Audio Feedback:** Includes a custom HTML5 audio chime on completion, which can be independently toggled on or off in the extension settings.

- **Context Menu & Tools Integration:** Provides a dedicated entry in Thunderbird's top **Tools** menu and right-click context menu options in the folder pane (`Compact folders with PurgPak`) for targeted single-account, Unified Folder, or single-folder execution.

---

## Compatibility

- **Thunderbird / Betterbird Version:** 128.0 and Newer

- **OS Tested:** Windows 10/11 (including IoT Enterprise / LTSC), Linux (LMDE7, Arch/EndeavourOS), macOS.

---

## Architecture: The "Thin Bridge"

PurgPak utilizes a hybrid "Thin Bridge" pattern to survive Thunderbird's rapid release cycle. The UI, options, and audio logic exist safely within sandboxed WebExtension ES modules, while low-level folder operations (`emptyTrash`, `emptyJunk`, `compactFolder`) are executed via a minimal, self-healing XPCOM experiment (`implementation.js`). 

---

## Installation

### Manual Install (.xpi)
1. Download the latest `PurgPak-v1.7.5.xpi` from the [Releases](https://github.com/CybTekSol/PurgPak/releases) section.

2. In Thunderbird/Betterbird, open **Tools > Add-ons and Themes** (or press `Ctrl + Shift + A`).
3. Click the gear icon in the top right and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file and confirm installation.

> **Note for Windows IoT / LTSC & Linux Desktop Users:** 
> As of version 1.4.0, manual `user.js` configurations (such as modifying `alerts.useSystemBackend`) are **no longer required**. PurgPak now completely bypasses the OS notification daemon and renders its summaries natively inside the Thunderbird application window.

---

## Configuration Settings

1. In Thunderbird/Betterbird, open **Tools > Add-ons and Themes** (or press `Ctrl + Shift + A`).

2. Scroll to find PurgPak in the list of Add-ons.
3. Click the "Wrench" icon on the right-side of the PurgPak entry in the list to access PurgPak's currently available "Options".
4. ALL available settings for accounts and functions are controlled by "ticking" or "unticking" their respective toggle box.
5. ENJOY your reclaimed time and disk space!

---

## Frequently Asked Questions

**Q: Can PurgPak expunge IMAP messages that are "Just marked as deleted" without restarting Thunderbird?**  
**A:** Yes! If your IMAP account is set to *When I delete a message > Just mark it as deleted*, those messages linger in your Inbox with a strikethrough until the server receives an `EXPUNGE` command. PurgPak actively detects messages carrying the `ImapDeleted` strikethrough flag and issues both a native IMAP `expunge` and folder `compact` command.

To clear this clutter on demand:
1. Open PurgPak's Options and ensure the **Compact** toggle is enabled for your accounts.

2. Whenever your Inbox (or Unified Inbox) gets too cluttered with strikethrough emails, simply click the PurgPak toolbar button (or use the new Tools / right-click folder menu options). 

PurgPak will instantly expunge and compact your folders, wiping away the strikethrough messages without ever needing to restart the application.

---

## Changelog

### Changes in version 1.7.5:
- **Unified Folders (`smart mailboxes`) Support:** Native XPCOM Descendants Traversal (GMX & European IMAP Fix) modified and hopefully fixed for right-click (`Compact folders with PurgPak`).

### Changes in version 1.7.0:
- **Unified Folders (`smart mailboxes`) Support:** Added native `nsMsgFolderFlags.Virtual` detection and `searchFolderUri` expansion so running PurgPak on a Unified Inbox or virtual folder automatically resolves, expunges, and compacts all underlying real IMAP/Local folders across all accounts.
- **Betterbird & Thunderbird 128+ Root Resolution Fix:** Bypassed WebExtension `folderManager.get("/")` exceptions on server root paths by resolving account roots directly through `MailServices.accounts`.
- **Native XPCOM Descendants Traversal (GMX & European IMAP Fix):** Replaced WebExtension folder tree recursion with direct XPCOM `rootFolder.descendants` traversal and native `nsMsgFolderFlags` bitmask inspection (`Trash`, `Junk`, `Inbox`), resolving `INBOX.` namespace mismatches and localized `prettyName` vs. `URI` discrepancies on GMX.com and European mail servers.
- **Explicit IMAP Expunge & Strikethrough Detection:** Added native `ImapDeleted` message flag inspection and explicit `nativeFolder.expunge()` execution prior to compaction, ensuring IMAP accounts configured with *"Just mark it as deleted"* reliably clear strikethrough messages across all accounts even when local `expungedBytes` reports zero.
- **Menu Integration:** Added a dedicated "Run PurgPak" entry to Thunderbird's top **Tools** menu and a right-click folder pane option (`Compact folders with PurgPak`) for executing targeted cleans on specific accounts, Unified Folders, or folder trees.

### Changes in version 1.6.5:
- **Native XPCOM Descendants Traversal (GMX & European IMAP Fix):** Replaced WebExtension folder tree recursion with direct XPCOM `rootFolder.descendants` traversal and native `nsMsgFolderFlags` bitmask inspection (`Trash`, `Junk`, `Inbox`), resolving `INBOX.` namespace mismatches and localized `prettyName` vs. `URI` discrepancies on GMX.com and European mail servers.
- **Explicit IMAP Expunge & Strikethrough Detection:** Added native `ImapDeleted` message flag inspection and explicit `nativeFolder.expunge()` execution prior to compaction, ensuring IMAP accounts configured with *"Just mark it as deleted"* reliably clear strikethrough messages across all accounts even when local `expungedBytes` reports zero.

### Changes in version 1.6.0:
- **Menu Integration:** Added a dedicated "Run PurgPak" entry to Thunderbird's top **Tools** menu and a right-click folder pane option (`Compact folders with PurgPak`) for executing targeted cleans on specific accounts or folder trees.
- **Asynchronous IMAP Purge Handling:** Upgraded `deleteMessages` in `implementation.js` to await `nsIMsgCopyServiceListener` completion callbacks before triggering folder compaction, preventing IMAP folder-lock collisions and ensuring accurate message purge counts.

### Changes in version 1.5.0:
- Major feature update! Added the ability to customize Junk/Trash/Compact settings individually for each e-mail account instead of globally (Thanks to user NotARealGit for the request!).

- Modified the Options UI CSS to provide a much more compact, polished, and readable experience.

- Note on Upgrading: PurgPak will attempt to automatically migrate your old global settings to the new per-account system. Please review your Options after updating to ensure everything is set to your liking. If your settings look incorrect after the update, simply set your checkboxes and click Save Settings to force a clean refresh of your profile. Please POST any issues you have with this release so I can address them!

### Changes in version 1.4.2:
- Added an independent **Show summary notification upon completion** toggle and an independent **Play notification sound upon completion** toggle in the PurgPak Configuration settings at user NotARealGit's request, allowing users to mute the completion chime while keeping visual summary banners active (or vice versa) or to enable/disable both.

### Changes in version 1.4.1:
- The Toolbar Button has been changed to simply "PurgPak" instead of "Run PurgPak" at user BY-Joe's request. Code remains unaltered.

---

## License

Licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) (GPL-3.0).