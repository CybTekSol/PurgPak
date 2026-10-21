"use strict";

const { classes: Cc, interfaces: Ci } = Components;

// --- Self-Healing Mozilla Module Imports ---
let ExtensionCommon, MailServices, Services;

try {
  ExtensionCommon = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs").ExtensionCommon;
} catch (e) {
  if (typeof ChromeUtils.import === "function") {
    ExtensionCommon = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm").ExtensionCommon;
  }
}

try {
  MailServices = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs").MailServices;
} catch (e) {
  if (typeof ChromeUtils.import === "function") {
    MailServices = ChromeUtils.import("resource:///modules/MailServices.jsm").MailServices;
  }
}

try {
  Services = globalThis.Services || ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs").Services;
} catch (e) {
  if (typeof ChromeUtils.import === "function") {
    Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
  }
}

var PurgPakAPI = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    function getNativeFolder(folder) {
      if (!folder) return null;
      try {
        if (context.extension.folderManager) {
          let found = context.extension.folderManager.get(folder.accountId, folder.path);
          if (found) return found;
        }
        if (folder.accountId && folder.path) {
          let account = MailServices.accounts.getAccount(folder.accountId);
          if (account && account.incomingServer) {
            let current = account.incomingServer.rootFolder;
            if (folder.path === "/") return current;
            let parts = folder.path.replace(/^\//, "").split("/");
            for (let part of parts) {
              if (!current) break;
              current = current.getChildNamed(decodeURIComponent(part));
            }
            return current;
          }
        }
      } catch (err) {
        console.error("PurgPak: Error resolving native folder:", err);
      }
      return null;
    }

    function getFolderDiskSize(msgFolder) {
      try {
        if (!msgFolder || !msgFolder.filePath || !msgFolder.filePath.exists()) return 0;
        return msgFolder.filePath.fileSize;
      } catch {
        return 0;
      }
    }

    async function purgeFolderMessages(nativeFolder) {
      if (!nativeFolder) return { messages: 0, bytes: 0 };

      let initialBytes = getFolderDiskSize(nativeFolder);
      let deletedCount = 0;

      try {
        let db = nativeFolder.msgDatabase;
        let enumerator = nativeFolder.messages;
        let array = [];

        if (enumerator) {
          while (enumerator.hasMoreElements()) {
            let msg = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
            array.push(msg);
          }
        }

        deletedCount = array.length;

        if (deletedCount > 0) {
          await new Promise((resolve) => {
            let settled = false;
            let finish = () => {
              if (!settled) {
                settled = true;
                resolve();
              }
            };

            let win = Services.wm.getMostRecentWindow("mail:3pane");
            if (win && win.setTimeout) {
              win.setTimeout(finish, 4000);
            }

            let copyListener = {
              QueryInterface: ChromeUtils.generateQI(["nsIUrlListener", "nsIMsgCopyServiceListener"]),
              OnStartCopy: function() {},
              OnProgress: function(aProgress, aProgressMax) {},
              SetMessageKey: function(aKey) {},
              GetMessageId: function(aMessageId) {},
              OnStopCopy: function(aStatus) {
                finish();
              }
            };

            try {
              nativeFolder.deleteMessages(array, null, true, false, copyListener, false);
            } catch (innerErr) {
              console.warn("PurgPak: deleteMessages exception:", innerErr);
              finish();
            }
          });
        }
      } catch (err) {
        console.warn("PurgPak: purgeFolderMessages exception:", err);
      }

      let finalBytes = getFolderDiskSize(nativeFolder);

      return {
        messages: deletedCount,
        bytes: Math.max(0, initialBytes - finalBytes)
      };
    }

    return {
      PurgPakAPI: {
        async emptyTrash(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          let result = await purgeFolderMessages(nativeFolder);

          if (result.messages === 0) {
            try {
              nativeFolder.emptyTrash(null, null);
            } catch (err) {}
          }

          return result;
        },

        async emptyJunk(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          return await purgeFolderMessages(nativeFolder);
        },

        async compactFolder(folder) {
          let nativeFolder = getNativeFolder(folder);
          if (!nativeFolder) return { messages: 0, bytes: 0 };

          if (!folder._forceCompact && nativeFolder.expungedBytes <= 0) {
            return { messages: 0, bytes: 0 };
          }

          let initialBytes = getFolderDiskSize(nativeFolder);

          await new Promise((resolve) => {
            let settled = false;
            let finish = () => {
              if (!settled) {
                settled = true;
                resolve();
              }
            };

            let win = Services.wm.getMostRecentWindow("mail:3pane");
            if (win && win.setTimeout) {
              win.setTimeout(finish, 5000);
            }

            let listener = {
              QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
              OnStartRunningUrl: function(url) {},
              OnStopRunningUrl: function(url, exitCode) {
                finish();
              }
            };

            try {
              nativeFolder.compact(listener, null);
            } catch (err) {
              console.warn("PurgPak: Native compact exception:", err);
              finish();
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
            let win = Services.wm.getMostRecentWindow("mail:3pane");
            if (!win) return;

            let notifyBox = win.gNotificationBox || 
                            win.specialTabs?.msgNotificationBar ||
                            win.document.querySelector("notificationbox");

            if (notifyBox) {
              const notificationId = "purgpak-summary-bar";

              let existing = notifyBox.getNotificationWithValue(notificationId);
              if (existing) {
                notifyBox.removeNotification(existing);
              }

              let priority = notifyBox.PRIORITY_INFO_HIGH || 5;
              let bannerText = `${title}: ${message.replace(/\n/g, " — ")}`;

              notifyBox.appendNotification(
                notificationId,
                {
                  label: bannerText,
                  priority: priority,
                },
                [] 
              );

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
            console.warn("PurgPak: In-app notification failed:", err);
          }
        }
      }
    };
  }
};