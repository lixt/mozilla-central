// This test uses bugzilla.mozilla.org given that it is likely to remain
// on the preload list for a long time.

function run_test() {
  let STSService = Cc["@mozilla.org/stsservice;1"]
                     .getService(Ci.nsIStrictTransportSecurityService);

  // check that a host on the preload list is identified as an sts host
  do_check_true(STSService.isStsHost("bugzilla.mozilla.org", 0));

  // now simulate that it's 19 weeks later than it actually is
  let offsetSeconds = 19 * 7 * 24 * 60 * 60;
  Services.prefs.setIntPref("test.currentTimeOffsetSeconds", offsetSeconds);

  // check that the preloaded host is no longer considered sts
  do_check_false(STSService.isStsHost("bugzilla.mozilla.org", 0));

  // just make sure we can get everything back to normal
  Services.prefs.clearUserPref("test.currentTimeOffsetSeconds");
  do_check_true(STSService.isStsHost("bugzilla.mozilla.org", 0));
}
