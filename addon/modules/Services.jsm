var EXPORTED_SYMBOLS = ["TabmixSvc"];

const Cc = Components.classes;
const Ci = Components.interfaces;

let TabmixSvc = {
  getString: function(aStringKey) {
    try {
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getFormattedString: function(aStringKey, aStringsArray) {
    try {
      return this._strings.formatStringFromName(aStringKey, aStringsArray, aStringsArray.length);
    } catch (e) {
      dump("*** Failed to format string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getSMString: function(aStringKey) {
    try {
      return this.SMstrings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: session-manager.properties\n");
      throw e;
    }
  },

  setLabel: function(property) {
    var label, key;
    if (property.indexOf("sm.") == 0) {
      label = this.getSMString(property + ".label");
      key = this.getSMString(property + ".accesskey");
    }
    else {
      label = this.getString(property + ".label");
      key = this.getString(property + ".accesskey");
    }
    var accessKeyIndex = label.toLowerCase().indexOf(key.toLowerCase());
    if (accessKeyIndex > -1)
      label = label.substr(0, accessKeyIndex) + "&" + label.substr(accessKeyIndex);
    return label;
  },

  topWin: function() {
    return this.wm.getMostRecentWindow("navigator:browser");
  }
}

Components.utils.import("resource://tabmixplus/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(TabmixSvc, "version", function () {
  var appInfo = Cc["@mozilla.org/xre/app-info;1"]
                          .getService(Ci.nsIXULAppInfo);
  var comparator = Cc["@mozilla.org/xpcom/version-comparator;1"]
                          .getService(Ci.nsIVersionComparator);
  var version = appInfo.version;
  let v = {value:version};
  v.is35 = comparator.compare(version, "3.1a2") > 0;
  v.is36 = comparator.compare(version, "3.6a1pre") >= 0;

  v.is40 = comparator.compare(version, "4.0b4") >= 0;
  v.is50 = comparator.compare(version, "5.0a1") >= 0;
  v.is60 = comparator.compare(version, "6.0a1") >= 0;
  return v;
});

/**
 * Lazily define services
 * Getters for common services, this should be replaced by Services.jsm in future
 */
if (TabmixSvc.version.is40) {
  Components.utils.import("resource://gre/modules/Services.jsm");
  XPCOMUtils.defineLazyGetter(TabmixSvc, "prefs", function () {return Services.prefs});
  XPCOMUtils.defineLazyGetter(TabmixSvc, "io", function () {return Services.io});
  XPCOMUtils.defineLazyGetter(TabmixSvc, "console", function () {return Services.console});
  XPCOMUtils.defineLazyGetter(TabmixSvc, "wm", function () {return Services.wm});
  XPCOMUtils.defineLazyGetter(TabmixSvc, "obs", function () {return Services.obs});
  XPCOMUtils.defineLazyGetter(TabmixSvc, "prompt", function () {return Services.prompt});
}
else {
  XPCOMUtils.defineLazyGetter(TabmixSvc, "prefs", function () {
    return Cc["@mozilla.org/preferences-service;1"]
             .getService(Ci.nsIPrefService)
             .QueryInterface(Ci.nsIPrefBranch2);
  });
  XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "io", "@mozilla.org/network/io-service;1", "nsIIOService2");
  XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "console", "@mozilla.org/consoleservice;1", "nsIConsoleService");
  XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "wm", "@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator");
  XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "obs", "@mozilla.org/observer-service;1", "nsIObserverService");
  XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "prompt", "@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");
}
// some prefs branches
XPCOMUtils.defineLazyGetter(TabmixSvc, "TMPprefs", function () {return TabmixSvc.prefs.getBranch("extensions.tabmix.")});
XPCOMUtils.defineLazyGetter(TabmixSvc, "SMprefs", function () {return TabmixSvc.prefs.getBranch("extensions.tabmix.sessions.")});
// string bundle
XPCOMUtils.defineLazyGetter(TabmixSvc, "_strings", function () {return Cc["@mozilla.org/intl/stringbundle;1"]
    .getService(Ci.nsIStringBundleService).createBundle("chrome://tabmixplus/locale/tabmix.properties");});
XPCOMUtils.defineLazyGetter(TabmixSvc, "SMstrings", function () {return Cc["@mozilla.org/intl/stringbundle;1"]
    .getService(Ci.nsIStringBundleService).createBundle("chrome://tabmixplus/locale/session-manager.properties");});
// sessionStore
XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "ss", "@mozilla.org/browser/sessionstore;1", "nsISessionStore");
