/* global
  ADDON_ENABLE: false,
  ADDON_DISABLE: false,
  ADDON_DOWNGRADE: false,
  ADDON_INSTALL: false,
  ADDON_UNINSTALL: false,
  ADDON_UPGRADE: false,
*/
/* eslint-env tabmix/webExtensions */
/* eslint no-var: 2, prefer-const: 2 */
/* exported install uninstall startup shutdown */
"use strict";

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {AddonManager} = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

ChromeUtils.defineModuleGetter(this, "ChromeManifest",
  "chrome://tabmix-resource/content/bootstrap/ChromeManifest.jsm");

ChromeUtils.defineModuleGetter(this, "Overlays",
  "chrome://tabmix-resource/content/bootstrap/Overlays.jsm");

ChromeUtils.defineModuleGetter(this, "ScriptsLoader",
  "chrome://tabmix-resource/content/bootstrap/ScriptsLoader.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixWidgets",
  "chrome://tabmix-resource/content/bootstrap/TabmixWidgets.jsm");

const appinfo = Services.appinfo;
const options = {
  application: appinfo.ID,
  appversion: appinfo.version,
  platformversion: appinfo.platformVersion,
  os: appinfo.OS,
  osversion: Services.sysinfo.getProperty("version"),
  abi: appinfo.XPCOMABI
};

const man = `
overlay   chrome://browser/content/browser.xhtml                 chrome://tabmixplus/content/tabmix.xhtml
overlay   about:addons                                           chrome://tabmixplus/content/preferences/overlay/aboutaddons.xhtml

overlay   chrome://browser/content/places/bookmarksSidebar.xhtml chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/historySidebar.xhtml   chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/places.xhtml           chrome://tabmixplus/content/places/places.xhtml
`;

/**
 * restartApplication: Restarts the application, keeping it in
 * safe mode if it is already in safe mode.
 */
function restartApplication() {
  const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );
  Services.obs.notifyObservers(
    cancelQuit,
    "quit-application-requested",
    "restart"
  );
  if (cancelQuit.data) {
    // The quit request has been canceled.
    return false;
  }
  // if already in safe mode restart in safe mode
  if (Services.appinfo.inSafeMode) {
    Services.startup.restartInSafeMode(
      Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
    );
    return undefined;
  }
  Services.startup.quit(
    Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
  );
  return undefined;
}

function showRestartNotification(verb, window) {
  window.PopupNotifications._currentNotifications.shift();
  window.PopupNotifications.show(
    window.gBrowser.selectedBrowser,
    'addon-install-restart',
    'Tab Mix Plus has been ' + verb + ', but a restart is required to ' + (verb == 'upgraded' || verb == 're-enabled' ? 'enable' : 'remove') + ' add-on functionality.',
    'addons-notification-icon',
    {
      label: 'Restart Now',
      accessKey: 'R',
      callback() {
        restartApplication();
      }
    },
    [{
      label: 'Not Now',
      accessKey: 'N',
      callback: () => { },
    }],
    {
      popupIconURL: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIgogICAgIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij4KICA8ZGVmcz4KICAgIDxzdHlsZT4KICAgICAgLnN0eWxlLXB1enpsZS1waWVjZSB7CiAgICAgICAgZmlsbDogdXJsKCcjZ3JhZGllbnQtbGluZWFyLXB1enpsZS1waWVjZScpOwogICAgICAgIGZpbGwtb3BhY2l0eTogLjI1OwogICAgICB9CiAgICAgIC5zdHlsZS1wdXp6bGUtcGllY2Utb3V0bGluZSB7CiAgICAgICAgZmlsbDogbm9uZTsKICAgICAgICBzdHJva2Utd2lkdGg6IDI7CiAgICAgICAgc3Ryb2tlOiAjNTJiMzNlOwogICAgICAgIHN0cm9rZS1kYXNoYXJyYXk6IDQgMjsKICAgICAgfQogICAgICAuc3R5bGUtYmFkZ2Utc2hhZG93IHsKICAgICAgICBmaWxsOiAjMGQxMzFhOwogICAgICAgIGZpbGwtb3BhY2l0eTogLjE1OwogICAgICB9CiAgICAgIC5zdHlsZS1iYWRnZS1iYWNrZ3JvdW5kIHsKICAgICAgICBmaWxsOiAjZmZmOwogICAgICB9CiAgICAgIC5zdHlsZS1iYWRnZS1pbnNpZGUgewogICAgICAgIGZpbGw6ICMwMGExZTU7CiAgICAgIH0KICAgICAgLnN0eWxlLWJhZGdlLWljb24gewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50LWxpbmVhci1wdXp6bGUtcGllY2UiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzY2Y2M1MiIgc3RvcC1vcGFjaXR5PSIxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzYwYmY0YyIgc3RvcC1vcGFjaXR5PSIxIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cGF0aCBjbGFzcz0ic3R5bGUtcHV6emxlLXBpZWNlIiBkPSJNNDIsNjJjMi4yLDAsNC0xLjgsNC00bDAtMTQuMmMwLDAsMC40LTMuNywyLjgtMy43YzIuNCwwLDIuMiwzLjksNi43LDMuOWMyLjMsMCw2LjItMS4yLDYuMi04LjIgYzAtNy0zLjktNy45LTYuMi03LjljLTQuNSwwLTQuMywzLjctNi43LDMuN2MtMi40LDAtMi44LTMuOC0yLjgtMy44VjIyYzAtMi4yLTEuOC00LTQtNEgzMS41YzAsMC0zLjQtMC42LTMuNC0zIGMwLTIuNCwzLjgtMi42LDMuOC03LjFjMC0yLjMtMS4zLTUuOS04LjMtNS45cy04LDMuNi04LDUuOWMwLDQuNSwzLjQsNC43LDMuNCw3LjFjMCwyLjQtMy40LDMtMy40LDNINmMtMi4yLDAtNCwxLjgtNCw0bDAsNy44IGMwLDAtMC40LDYsNC40LDZjMy4xLDAsMy4yLTQuMSw3LjMtNC4xYzIsMCw0LDEuOSw0LDZjMCw0LjItMiw2LjMtNCw2LjNjLTQsMC00LjItNC4xLTcuMy00LjFjLTQuOCwwLTQuNCw1LjgtNC40LDUuOEwyLDU4IGMwLDIuMiwxLjgsNCw0LDRIMTljMCwwLDYuMywwLjQsNi4zLTQuNGMwLTMuMS00LTMuNi00LTcuN2MwLTIsMi4yLTQuNSw2LjQtNC41YzQuMiwwLDYuNiwyLjUsNi42LDQuNWMwLDQtMy45LDQuNi0zLjksNy43IGMwLDQuOSw2LjMsNC40LDYuMyw0LjRINDJ6Ii8+CiAgPHBhdGggY2xhc3M9InN0eWxlLXB1enpsZS1waWVjZS1vdXRsaW5lIiBkPSJNMjMuNiwzYzYuMywwLDcuMywzLDcuMyw0LjljMCwyLjItMSwzLjEtMiw0Yy0wLjgsMC44LTEuOCwxLjYtMS44LDMuMWMwLDIuNiwyLjcsMy43LDQuMyw0bDAuMSwwaDAuMUg0MiBjMS43LDAsMywxLjQsMywzdjUuOHYwbDAsMGMwLjIsMS43LDEuMiw0LjcsMy44LDQuN2MxLjUsMCwyLjMtMC45LDMtMS44YzAuOC0xLDEuNi0xLjksMy43LTEuOWMzLjUsMCw1LjIsMi4yLDUuMiw2LjkgYzAsNi4yLTMuMiw3LjItNS4yLDcuMmMtMi4xLDAtMi45LTEtMy43LTJjLTAuNy0wLjktMS41LTEuOS0zLTEuOWMtMi42LDAtMy42LDIuOS0zLjgsNC42bDAsMGwwLDBMNDUsNThjMCwxLjYtMS4zLDMtMywzaC01LjJsMCwwIGwwLDBjMCwwLTAuMSwwLTAuMywwYy00LjUsMC00LjktMi40LTQuOS0zLjRjMC0xLDAuNS0xLjYsMS41LTIuNmMxLjEtMS4xLDIuNC0yLjUsMi40LTUuMWMwLTMuMy0zLjktNS41LTcuNi01LjUgYy00LjYsMC03LjQsMi44LTcuNCw1LjVjMCwyLjYsMS40LDQsMi41LDUuMWMxLDEsMS41LDEuNiwxLjUsMi42YzAsMy4xLTMuNCwzLjQtNC45LDMuNGMtMC4yLDAtMC4zLDAtMC4zLDBsMCwwaDBINiBjLTEuNiwwLTMtMS4zLTMtM2wwLTEyLjJsMCwwbDAsMGMwLDAtMC4xLTIuNSwxLjEtMy45YzAuNi0wLjYsMS4zLTAuOSwyLjMtMC45YzAuOSwwLDEuNSwwLjUsMi4zLDEuNWMxLDEuMiwyLjMsMi42LDQuOSwyLjYgYzMuMywwLDUtMy42LDUtNy4zYzAtMy40LTEuNi03LTUtN2MtMi42LDAtMy45LDEuNC00LjksMi42Yy0wLjksMS0xLjQsMS41LTIuMywxLjVjLTEsMC0xLjctMC4zLTIuMy0wLjlDMi44LDMyLjYsMywyOS45LDMsMjkuOSBsMCwwbDAsMEwzLDIyYzAtMS43LDEuMy0zLDMtM2g5LjdoMC4xbDAuMSwwYzEuNi0wLjMsNC4zLTEuNCw0LjMtNGMwLTEuNC0wLjktMi4zLTEuNi0zLjFjLTAuOS0xLTEuOC0xLjktMS44LTQuMSBDMTYuNiw0LjYsMTguOSwzLDIzLjYsMyIvPgogIDxzdmcgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiB4PSIzMiIgeT0iMCI+CiAgICA8ZWxsaXBzZSBjbGFzcz0ic3R5bGUtYmFkZ2Utc2hhZG93IiAgICAgcng9IjE0IiByeT0iMTUiIGN4PSIxNiIgY3k9IjE3IiAvPgogICAgPGNpcmNsZSAgY2xhc3M9InN0eWxlLWJhZGdlLWJhY2tncm91bmQiIHI9IjE1IiAgY3k9IjE1IiBjeD0iMTYiIC8+CiAgICA8Y2lyY2xlICBjbGFzcz0ic3R5bGUtYmFkZ2UtaW5zaWRlIiAgICAgcj0iMTIiICBjeT0iMTUiIGN4PSIxNiIgLz4KICAgIDxwYXRoICAgIGNsYXNzPSJzdHlsZS1iYWRnZS1pY29uIiBkPSJNMjEsMTVoLTZsMi40LTIuNGMtMC42LTAuNC0xLjItMC42LTEuOS0wLjZjLTIsMC0zLjUsMS42LTMuNSwzLjUgYzAsMiwxLjYsMy41LDMuNSwzLjVjMSwwLDItMC41LDIuNi0xLjJsMS43LDFjLTEsMS4zLTIuNiwyLjEtNC4zLDIuMWMtMywwLTUuNS0yLjUtNS41LTUuNWMwLTMsMi41LTUuNSw1LjUtNS41IGMxLjMsMCwyLjQsMC40LDMuMywxLjJMMjEsOVYxNXoiLz4KICA8L3N2Zz4KPC9zdmc+Cg==',
      persistent: false,
      hideClose: true,
      timeout: window.performance.timing.navigationStart + window.performance.now() + 30000,
      removeOnDismissal: true
    }
  );
}

async function install(data) {
  const addon = await AddonManager.getAddonByID(data.id);
  if (addon?.__AddonInternal__) {
    addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
  }
}

function uninstall() { }

async function startup(data, reason) {
  const chromeManifest = new ChromeManifest(() => {
    return man;
  }, options);
  await chromeManifest.parse();

  AddonManager.getAddonByID(data.id).then(addon => {
    if (addon?.__AddonInternal__) {
      addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
    }
  });

  TabmixWidgets.create();

  const window = Services.wm.getMostRecentWindow('navigator:browser');
  if (reason === ADDON_UPGRADE || reason === ADDON_DOWNGRADE) {
    showRestartNotification("upgraded", window);
    return;
  }

  if (reason === ADDON_INSTALL || reason === ADDON_ENABLE && !window.Tabmix) {
    const enumerator = Services.wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();
      const document = win.document;
      if (document.createXULElement) {
        const isBrowser = document.documentElement.getAttribute("windowtype") === "navigator:browser";
        const isOverflow = isBrowser && win.gBrowser.tabContainer.getAttribute("overflow");
        const promiseOverlayLoaded = Overlays.load(chromeManifest, document.defaultView);
        if (isBrowser) {
          ScriptsLoader.initForWindow(win, promiseOverlayLoaded, {
            chromeManifest,
            isOverflow,
            isEnabled: true,
          });
        }
      }
    }
  }

  const documentObserver = {
    observe(document) {
      if (document.createXULElement) {
        const promiseOverlayLoaded = Overlays.load(chromeManifest, document.defaultView);
        if (document.documentElement.getAttribute("windowtype") === "navigator:browser") {
          ScriptsLoader.initForWindow(document.defaultView, promiseOverlayLoaded);
        }
      }
    }
  };

  // eslint-disable-next-line mozilla/balanced-observers
  Services.obs.addObserver(documentObserver, "chrome-document-loaded");
}

function shutdown(data, reason) {
  const window = Services.wm.getMostRecentWindow('navigator:browser');
  if (reason === ADDON_DISABLE) {
    showRestartNotification("disabled", window);
  } else if (reason === ADDON_UNINSTALL /* && window.Tabmix */) {
    showRestartNotification("uninstalled", window);
  }

  TabmixWidgets.destroy(reason === ADDON_UNINSTALL);
}
