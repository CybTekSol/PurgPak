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

// Native XPCOM Folder & Message Bitmasks
const FLAG_VIRTUAL = Ci.nsMsgFolderFlags?.Virtual || 0x00000020;
const FLAG_TRASH   = Ci.nsMsgFolderFlags?.Trash   || 0x00000100;
const FLAG_INBOX   = Ci.nsMsgFolderFlags?.Inbox   || 0x00001000;
const FLAG_JUNK    = Ci.nsMsgFolderFlags?.Junk    || 0x40000000;
const MSG_FLAG_IMAP_DELETED = 0x00200000;

const JUNK_NAMES = new Set([
  "junk", "junk e-mail", "junk email", "spam", "spamverdacht", "bulk", "bulk mail", "pourriel", "correo no deseado"
]);

const TRASH_NAMES = new Set([
  "trash", "deleted", "deleted items", "deleted messages", "bin", "papierkorb", "gelöscht", "geloscht", "corbeille", "papelera"
]);

var PurgPakAPI = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    function getNativeFolder(folder) {
      if (!folder) return null;

      // 1. If requesting account root ("/"), go straight to MailServices.accounts
      if (folder.accountId && (!folder.path || folder.path === "/")) {
        try {
          let account = MailServices.accounts.getAccount(folder.accountId);
          if (account && account.incomingServer && account.incomingServer.rootFolder) {
            return account.incomingServer.rootFolder;
          }
        } catch (err) {}
      }

      // 2. Try context.extension.folderManager in its own isolated try/catch
      if (context.extension && context.extension.folderManager && folder.accountId && folder.path && folder.path !== "/") {
        try {
          let found = context.extension.folderManager.get(folder.accountId, folder.path);
          if (found) return found;
        } catch (e) {}
      }

      // 3. Fallback: walk XPCOM rootFolder.descendants directly
      if (folder.accountId) {
        try {
          let account = MailServices.accounts.getAccount(folder.accountId);
          if (account && account.incomingServer && account.incomingServer.rootFolder) {
            let root = account.incomingServer.rootFolder;
            if (!folder.path || folder.path === "/") return root;

            let targetPath = String(folder.path).toLowerCase();
            let targetName = String(folder.name || "").trim().toLowerCase();
            let allFolders = root.descendants;

            for (let f of allFolders) {
              try {
                let uriDecoded = decodeURIComponent(f.URI || "").toLowerCase();
                if (uriDecoded.endsWith(targetPath)) {
                  return f;
                }
              } catch (e) {}
            }
            for (let f of allFolders) {
              if (String(f.prettyName || "").trim().toLowerCase() === targetName ||
                  String(f.name || "").trim().toLowerCase() === targetName) {
                return f;
              }
            }
          }
        } catch (err) {}
      }

      return null;
    }

    // Expand Virtual/Unified folders (e.g. Betterbird/Thunderbird "smart mailboxes") into their real underlying folders
    function expandVirtualFolder(msgFolder) {
      let realFolders = [];
      try {
        let dbFolderInfo = msgFolder.msgDatabase && msgFolder.msgDatabase.dBFolderInfo;
        if (dbFolderInfo) {
          let srchUris = dbFolderInfo.getCharProperty("searchFolderUri");
          if (srchUris) {
            let uriList = srchUris.split("|");
            for (let u of uriList) {
              if (!u) continue;
              try {
                let realF = MailServices.folderLookup.getFolderForURL(u);
                if (realF && !realF.isServer) {
                  realFolders.push(realF);
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
      return realFolders;
    }

    // Collect a native folder and all of its XPCOM descendants
    function getSelfAndDescendants(nativeFolder) {
      let list = [];
      let seenUris = new Set();

      function addFolder(f) {
        if (!f || f.isServer) return;
        if ((f.flags & FLAG_VIRTUAL) !== 0) {
          let underlying = expandVirtualFolder(f);
          for (let realF of underlying) {
            if (realF && !realF.isServer && !seenUris.has(realF.URI)) {
              seenUris.add(realF.URI);
              list.push(realF);
            }
          }
          return;
        }
        if (!seenUris.has(f.URI)) {
          seenUris.add(f.URI);
          list.push(f);
        }
      }

      if (!nativeFolder) return list;
      addFolder(nativeFolder);

      try {
        let desc = nativeFolder.descendants;
        if (desc) {
          for (let f of desc) {
            addFolder(f);
          }
        }
      } catch (e) {}

      return list;
    }

    function isNativeJunk(msgFolder) {
      if (!msgFolder || msgFolder.isServer) return false;
      if ((msgFolder.flags & FLAG_JUNK) !== 0) return true;
      let pName = String(msgFolder.prettyName || "").trim().toLowerCase();
      let rName = String(msgFolder.name || "").trim().toLowerCase();
      let uriLeaf = "";
      try {
        uriLeaf = decodeURIComponent(String(msgFolder.URI || "").split("/").pop()).trim().toLowerCase();
      } catch (e) {}
      return (JUNK_NAMES.has(pName) || JUNK_NAMES.has(rName) || JUNK_NAMES.has(uriLeaf));
    }

    function isNativeTrash(msgFolder) {
      if (!msgFolder || msgFolder.isServer) return false;
      if ((msgFolder.flags & FLAG_TRASH) !== 0) return true;
      let pName = String(msgFolder.prettyName || "").trim().toLowerCase();
      let rName = String(msgFolder.name || "").trim().toLowerCase();
      let uriLeaf = "";
      try {
        uriLeaf = decodeURIComponent(String(msgFolder.URI || "").split("/").pop()).trim().toLowerCase();
      } catch (e) {}
      return (TRASH_NAMES.has(pName) || TRASH_NAMES.has(rName) || TRASH_NAMES.has(uriLeaf));
    }

    function getFolderDiskSize(msgFolder) {
      try {
        if (!msgFolder || !msgFolder.filePath || !msgFolder.filePath.exists()) return 0;
        return msgFolder.filePath.fileSize;
      } catch {
        return 0;
      }
    }

    function countImapDeletedMessages(msgFolder) {
      let count = 0;
      try {
        let db = msgFolder.msgDatabase;
        let enumerator = msgFolder.messages;
        if (enumerator) {
          while (enumerator.hasMoreElements()) {
            let msg = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
            if ((msg.flags & MSG_FLAG_IMAP_DELETED) !== 0) {
              count++;
            }
          }
        }
      } catch (e) {}
      return count;
    }

    async function purgeFolderMessages(nativeFolder) {
      if (!nativeFolder || nativeFolder.isServer) return { messages: 0, bytes: 0 };

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
              finish();
            }
          });
        }
      } catch (err) {}

      let finalBytes = getFolderDiskSize(nativeFolder);

      return {
        messages: deletedCount,
        bytes: Math.max(0, initialBytes - finalBytes)
      };
    }

    async function compactSingleNativeFolder(nativeFolder, forceCompact) {
      if (!nativeFolder || nativeFolder.isServer) return { messages: 0, bytes: 0 };

      let isImap = Boolean(nativeFolder.server && nativeFolder.server.type === "imap");
      let isInbox = ((nativeFolder.flags & FLAG_INBOX) !== 0);
      let expungedBytes = nativeFolder.expungedBytes || 0;
      let hasExpunged = (expungedBytes > 0);
      let strikethroughCount = isImap ? countImapDeletedMessages(nativeFolder) : 0;
      let hasStrikethrough = (strikethroughCount > 0);

      if (!isImap && !forceCompact && !hasExpunged) {
        return { messages: 0, bytes: 0 };
      }

      if (isImap && !forceCompact && !hasExpunged && !hasStrikethrough && !isInbox) {
        return { messages: 0, bytes: 0 };
      }

      let initialBytes = getFolderDiskSize(nativeFolder);

      // Step 1: Explicit IMAP EXPUNGE for strikethrough messages
      if (isImap && typeof nativeFolder.expunge === "function") {
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

          let expungeListener = {
            QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
            OnStartRunningUrl: function(url) {},
            OnStopRunningUrl: function(url, exitCode) {
              finish();
            }
          };

          try {
            nativeFolder.expunge(expungeListener, null);
          } catch (e) {
            finish();
          }
        });
      }

      // Step 2: Compact local/offline store
      if (forceCompact || isImap || nativeFolder.expungedBytes > 0 || hasExpunged) {
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

          let compactListener = {
            QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
            OnStartRunningUrl: function(url) {},
            OnStopRunningUrl: function(url, exitCode) {
              finish();
            }
          };

          try {
            nativeFolder.compact(compactListener, null);
          } catch (err) {
            finish();
          }
        });
      }

      let finalBytes = getFolderDiskSize(nativeFolder);
      let recovered = Math.max(0, initialBytes - finalBytes);

      return {
        messages: 0,
        bytes: recovered
      };
    }

    return {
      PurgPakAPI: {
        async emptyTrash(folder) {
          let startFolder = getNativeFolder(folder);
          if (!startFolder) return { messages: 0, bytes: 0 };

          let candidates = folder._scanAll ? getSelfAndDescendants(startFolder) : getSelfAndDescendants(startFolder).slice(0, 1);
          let totalMessages = 0;
          let totalBytes = 0;

          for (let f of candidates) {
            if (!folder._scanAll || isNativeTrash(f)) {
              let res = await purgeFolderMessages(f);
              totalMessages += res.messages || 0;
              totalBytes += res.bytes || 0;
            }
          }

          return { messages: totalMessages, bytes: totalBytes };
        },

        async emptyJunk(folder) {
          let startFolder = getNativeFolder(folder);
          if (!startFolder) return { messages: 0, bytes: 0 };

          let candidates = folder._scanAll ? getSelfAndDescendants(startFolder) : getSelfAndDescendants(startFolder).slice(0, 1);
          let totalMessages = 0;
          let totalBytes = 0;

          for (let f of candidates) {
            if (!folder._scanAll || isNativeJunk(f)) {
              let res = await purgeFolderMessages(f);
              totalMessages += res.messages || 0;
              totalBytes += res.bytes || 0;
            }
          }

          return { messages: totalMessages, bytes: totalBytes };
        },

        async compactFolder(folder) {
          let startFolder = getNativeFolder(folder);
          if (!startFolder) return { messages: 0, bytes: 0 };

          let candidates = folder._scanAll ? getSelfAndDescendants(startFolder) : getSelfAndDescendants(startFolder);
          let totalBytes = 0;

          for (let f of candidates) {
            let res = await compactSingleNativeFolder(f, Boolean(folder._forceCompact));
            totalBytes += res.bytes || 0;
          }

          return { messages: 0, bytes: totalBytes };
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
              let bannerText = String(title) + ": " + String(message).replace(/\n/g, " — ");

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
          } catch (err) {}
        }
      }
    };
  }
};