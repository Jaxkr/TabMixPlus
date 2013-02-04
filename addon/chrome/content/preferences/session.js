var gSessionPane = {
  gSessionManager: null,
  init: function () {
    // disable TMP session manager setting if session manager extension is install
    this.gSessionManager = Tabmix.getTopWin().Tabmix.extensions.sessionManager;
    if (this.gSessionManager) {
///      $("sessionmanager_ext").hidden = false;
      $("sessionmanager_button").setAttribute("image", "chrome://sessionmanager/skin/icon.png");
      $("sessionmanager_ext_tab").hidden = false;
      $("sessionStore_tab").hidden = true;
      $("tabmix_tab").hidden = true;
      $("paneSession-tabbox").selectedIndex = 0;
      $("chooseFile").selectedIndex = 1;
    }
    else {
      // create saved Session popup menu
      var popup = $("onStart.popup");
      TabmixSessionManager.createMenuForDialog(popup);
    }

    gSetTabIndex.init('session');

    TM_Options.initBroadcasters("paneSession", true);
    TM_Options.initUndoCloseBroadcaster();
    TM_Options.setDisabled("obs_ss_postdata", $("ss_postdata").value == 2);
    this.isSessionStoreEnabled(false);

    gCommon.setPaneWidth("paneSession");
//    gCommon.setTopMargin("paneSession");
  },

//XXX TODO use this
//XXX check if we need it with Firefox 3.0+
  verify_PostDataBytes: function() {
    var ss_postdatabytes = $("ss_postdatabytes");
    var val = ss_postdatabytes.value;
    if (val == "-" || val == "") {
       updateApplyData(ss_postdatabytes, val == "" ? "0" : "-1");
    }
  },

  updateSessionShortcuts: function() {
    if (typeof gMenuPane == "object")
      gMenuPane.updateSessionShortcuts();
  },

  isSessionStoreEnabled: function (checkService) {
    var browserWindow = Tabmix.getTopWin();
    if (checkService)
      browserWindow.TMP_SessionStore.setService(2, false, window);

    this.updateSessionShortcuts();
    if (this.gSessionManager)
      return;

    var sessionStoreEnabled = browserWindow.TMP_SessionStore.isSessionStoreEnabled();
    var currentState = $("sessionstore_0").checked;
    if (currentState != sessionStoreEnabled || (!checkService && !sessionStoreEnabled)) {
      $("sessionstore_0").checked = sessionStoreEnabled;
      $("sessionstore_1").checked = sessionStoreEnabled;
      $("paneSession-tabbox").selectedIndex = sessionStoreEnabled ? 1 : 2;
    }
  },

  setSessionsOptions: function (item, id) {
//alert("setSessionsOptions " + id);
    var useSessionManager = !item.checked;
    $("paneSession-tabbox").selectedIndex = item.checked ? 1 : 2;
    $(id).checked = item.checked;
    $(id).focus();

    this.updateSessionShortcuts();

    function updatePrefs(aItemId, aValue) {
      let preference = $("pref_" + aItemId);
      preference.batching = true;
      preference.value = aValue;
      preference.batching = false;
//XXXX
//      updateApplyData(item, aValue);
    }

    // prevent TMP_SessionStore.setService from runing
    var browserWindow = Tabmix.getTopWin();
    browserWindow.tabmix_setSession = true;
    // TMP session pref
    updatePrefs("sessionManager", useSessionManager);
    updatePrefs("sessionCrashRecovery", useSessionManager);

    // sessionstore pref
    updatePrefs("browser.warnOnRestart", !useSessionManager);
    updatePrefs("browser.warnOnQuit", !useSessionManager);
    updatePrefs("resume_from_crash", !useSessionManager);
    // "browser.startup.page"
    updatePrefs("browserStartupPage", useSessionManager ? 1 : 3);

    delete browserWindow.tabmix_setSession;

///XXX check if we need to save here when instant apply
//this.preferences.service.savePrefFile(null);
  },

  sessionManagerOptions: function () {
    var browserWindow = Tabmix.getTopWin();
    browserWindow.TabmixConvertSession.sessionManagerOptions();
  },

  convertSession: function () {
    var browserWindow = Tabmix.getTopWin();
    if ($("chooseFile").selectedItem.value == 0)
      browserWindow.TabmixConvertSession.selectFile(window);
    else
     browserWindow.TabmixConvertSession.convertFile();

    window.focus();
  }

}
