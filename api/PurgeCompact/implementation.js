"use strict";

const { classes: Cc, interfaces: Ci } = Components;

// --- Self-Healing Mozilla Module Imports ---
let ExtensionCommon, MailServices;

try {
  ExtensionCommon = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs").ExtensionCommon;
} catch (e) {
  ExtensionCommon = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm").ExtensionCommon;
}

try {
  MailServices = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs").MailServices;
} catch (e) {
  MailServices = ChromeUtils.import("resource:///modules/MailServices.jsm").MailServices;
}

var PurgeCompactAPI = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    // Helper: Map WebExtension folder payload to native nsIMsgFolder
    function getNativeFolder(folder) {
      if (!folder) return null;
      try {
        if (context.extension.folderManager) {
          return context.extension.folderManager.get(folder.accountId, folder.path);
        }
        if (folder.accountId && folder.path) {
          let account = MailServices.accounts.getAccount(folder.accountId);
          if (account && account.incomingServer) {
            let root = account.incomingServer.rootFolder;
            if (folder.path === "/") return root;
            return root.getChildNamed(folder.path.replace(/^\//, ""));
          }
        }
      } catch (err) {
        console.error("PurgeCompact: Error resolving native folder:", err);
      }
      return null;
    }

    // Helper: Measure physical file size of a folder
    function getFolderDiskSize(msgFolder) {
      try {
        if (!msgFolder || !msgFolder.filePath || !msgFolder.filePath.exists()) return 0;
        return msgFolder.filePath.fileSize;
      } catch {
        return 0;
      }
    }

    return {
      PurgeCompactAPI: {
        async emptyTrash(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          let initialBytes = getFolderDiskSize(nativeFolder);
          let initialMsgs = nativeFolder.getTotalMessages(false);

          try {
            nativeFolder.emptyTrash(null, null);
          } catch (err) {
            console.warn("PurgeCompact: Native emptyTrash exception:", err);
          }

          let finalBytes = getFolderDiskSize(nativeFolder);
          let finalMsgs = nativeFolder.getTotalMessages(false);

          return {
            messages: Math.max(0, initialMsgs - finalMsgs),
            bytes: Math.max(0, initialBytes - finalBytes)
          };
        },

        async emptyJunk(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          let initialBytes = getFolderDiskSize(nativeFolder);
          let initialMsgs = nativeFolder.getTotalMessages(false);

          try {
            let messages = [...nativeFolder.messages];
            let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
            for (let msg of messages) {
              array.appendElement(msg);
            }
            nativeFolder.deleteMessages(array, null, true, false, null, false);
          } catch (err) {
            console.warn("PurgeCompact: Native emptyJunk exception:", err);
          }

          let finalBytes = getFolderDiskSize(nativeFolder);
          let finalMsgs = nativeFolder.getTotalMessages(false);

          return {
            messages: Math.max(0, initialMsgs - finalMsgs),
            bytes: Math.max(0, initialBytes - finalBytes)
          };
        },

        async compactFolder(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          if (nativeFolder.expungedBytes <= 0) {
            return { messages: 0, bytes: 0 };
          }

          let initialBytes = getFolderDiskSize(nativeFolder);

          await new Promise((resolve) => {
            let listener = {
              QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
              OnStartRunningUrl: function(url) {},
              OnStopRunningUrl: function(url, exitCode) {
                resolve();
              }
            };

            try {
              nativeFolder.compact(listener, null);
            } catch (err) {
              console.warn("PurgeCompact: Native compact exception:", err);
              resolve();
            }
          });

          let finalBytes = getFolderDiskSize(nativeFolder);

          return {
            messages: 0,
            bytes: Math.max(0, initialBytes - finalBytes)
          };
        },

        async showNotification(title, message) {
          try {
            // Find the active 3-pane Thunderbird window using the globally available Services
            let win = Services.wm.getMostRecentWindow("mail:3pane");
            if (!win) return;

            // Access Thunderbird's main notification box
            let notifyBox = win.gNotificationBox || 
                            win.specialTabs?.msgNotificationBar ||
                            win.document.querySelector("notificationbox");

            if (notifyBox) {
              const notificationId = "purgecompact-summary-bar";

              // Remove any existing PurgeCompact notification banner first
              let existing = notifyBox.getNotificationWithValue(notificationId);
              if (existing) {
                notifyBox.removeNotification(existing);
              }

              // Append a clean, non-intrusive banner
              let priority = notifyBox.PRIORITY_INFO_HIGH || 5;
              let bannerText = `${title}: ${message.replace(/\n/g, " — ")}`;

              let notification = notifyBox.appendNotification(
                notificationId,
                {
                  label: bannerText,
                  priority: priority,
                },
                [] 
              );

              // Automatically dismiss after 6 seconds
              if (win.setTimeout) {
                win.setTimeout(() => {
                  try {
                    let current = notifyBox.getNotificationWithValue(notificationId);
                    if (current) {
                      notifyBox.removeNotification(current);
                    }
                  } catch (e) {}
                }, 6000);
              }
            }
          } catch (err) {
            console.warn("PurgeCompact: In-app notification failed:", err);
          }
        }
      }
    };
  }
};