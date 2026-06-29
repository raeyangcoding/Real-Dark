// This script runs with Chrome privileges in the parent process.
// It has full access to Services.prefs — the Firefox preferences system.
// Mozilla uses the exact same pattern in their built-in system addons
// (browser/extensions/webcompat, browser/extensions/pictureinpicture).

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

this.aboutConfigPrefs = class extends ExtensionAPI {
  getAPI(context) {
    // Re-import inside getAPI to ensure Services is available in this scope
    const { Services: Svc } = ChromeUtils.import(
      "resource://gre/modules/Services.jsm"
    );

    return {
      aboutConfigPrefs: {
        async getInt(pref) {
          try {
            return Svc.prefs.getIntPref(pref);
          } catch (e) {
            console.error(`[aboutConfigPrefs] getInt("${pref}") 失败:`, e.message);
            throw e;
          }
        },

        async setInt(pref, value) {
          try {
            Svc.prefs.setIntPref(pref, value);
            console.log(`[aboutConfigPrefs] setInt("${pref}", ${value}) 成功`);
          } catch (e) {
            console.error(`[aboutConfigPrefs] setInt("${pref}", ${value}) 失败:`, e.message);
            throw e;
          }
        },

        async getBool(pref) {
          try {
            return Svc.prefs.getBoolPref(pref);
          } catch (e) {
            console.error(`[aboutConfigPrefs] getBool("${pref}") 失败:`, e.message);
            throw e;
          }
        },

        async setBool(pref, value) {
          try {
            Svc.prefs.setBoolPref(pref, value);
            console.log(`[aboutConfigPrefs] setBool("${pref}", ${value}) 成功`);
          } catch (e) {
            console.error(`[aboutConfigPrefs] setBool("${pref}", ${value}) 失败:`, e.message);
            throw e;
          }
        }
      }
    };
  }
};
