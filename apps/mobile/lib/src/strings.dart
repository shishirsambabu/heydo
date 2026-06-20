/// Heydo UI strings — Malayalam-first (default), English secondary.
///
/// Phase 1 uses a simple in-app map so the onboarding flow is fully localized
/// from the first commit (localization rule). The production path migrates these
/// to ARB + flutter_localizations, but NO user-facing string is ever hard-coded
/// in English in a widget. See .claude/rules/localization.md
enum Lang { ml, en }

class S {
  S(this.lang);
  final Lang lang;

  String _t(String ml, String en) => lang == Lang.ml ? ml : en;

  // App
  String get appName => 'Heydo';
  // Primary brand tagline: "Trust who shows up."
  String get tagline => _t('വന്നെത്തുന്നവരെ വിശ്വസിക്കാം', 'Trust who shows up');

  // Language screen
  String get chooseLanguage => _t('ഭാഷ തിരഞ്ഞെടുക്കുക', 'Choose your language');
  String get malayalam => 'മലയാളം';
  String get english => 'English';

  // Phone / OTP
  String get enterPhone => _t('ഫോൺ നമ്പർ നൽകുക', 'Enter your phone number');
  String get phoneHint => _t('10 അക്ക മൊബൈൽ നമ്പർ', '10-digit mobile number');
  String get sendOtp => _t('OTP അയയ്ക്കുക', 'Send OTP');
  String get enterOtp => _t('OTP നൽകുക', 'Enter the OTP');
  String get otpSentTo => _t('OTP അയച്ചു', 'OTP sent to');
  String get verify => _t('പരിശോധിക്കുക', 'Verify');

  // Role
  String get chooseRole => _t('നിങ്ങൾ ആരാണ്?', 'Who are you?');
  String get iAmWorker => _t('എനിക്ക് ജോലി വേണം (തൊഴിലാളി)', 'I want work (Worker)');
  String get iAmGiver => _t('എനിക്ക് ജോലി ചെയ്യിക്കണം (നൽകുന്നയാൾ)', 'I need a job done (Giver)');
  String get yourName => _t('നിങ്ങളുടെ പേര്', 'Your name');

  // Consent / VKYC
  String get verifyIdentity => _t('നിങ്ങളുടെ ഐഡന്റിറ്റി പരിശോധിക്കാം', 'Let’s verify your identity');
  String get vkycExplainer => _t(
      'ഒരു ചെറിയ വീഡിയോ പരിശോധനയിലൂടെ നിങ്ങൾ യഥാർത്ഥ വ്യക്തിയാണെന്ന് ഉറപ്പാക്കുന്നു. നിങ്ങളുടെ ആധാർ നമ്പർ ഞങ്ങൾ സൂക്ഷിക്കില്ല.',
      'A short video check confirms you are a real person. We never store your Aadhaar number.');
  String get consentLine => _t(
      'പരിശോധനയ്ക്കായി എന്റെ വിവരങ്ങൾ ഉപയോഗിക്കാൻ ഞാൻ സമ്മതിക്കുന്നു.',
      'I consent to using my details for verification.');
  String get giverVkycExplainer => _t(
      'ജോലി പോസ്റ്റ് ചെയ്യുന്നവരും വീഡിയോ പരിശോധന പൂർത്തിയാക്കണം. ഇത് തൊഴിലാളികളുടെ സുരക്ഷയ്ക്കാണ്.',
      'Gig posters must complete video verification too. This protects workers and keeps Heydo safe.');
  String get startVkyc => _t('വീഡിയോ പരിശോധന തുടങ്ങുക', 'Start video verification');
  String get simulateResult => _t('പരിശോധന പൂർത്തിയാക്കുക (ഡെമോ)', 'Complete verification (demo)');

  // Status
  String get statusUnverified => _t('പരിശോധിച്ചിട്ടില്ല', 'Not verified');
  String get statusPending => _t('പരിശോധനയിലാണ്', 'Under review');
  String get statusApproved => _t('പരിശോധിച്ചു ✓', 'Verified ✓');
  String get statusRejected => _t('നിരസിച്ചു', 'Rejected');
  String get pendingMsg => _t(
      'നന്ദി! ഞങ്ങളുടെ ടീം നിങ്ങളുടെ പരിശോധന അവലോകനം ചെയ്യുന്നു. ഉടൻ അറിയിക്കും.',
      'Thank you! Our team is reviewing your verification. You’ll hear from us soon.');
  String get approvedMsg => _t(
      'അഭിനന്ദനങ്ങൾ! ഇപ്പോൾ നിങ്ങൾക്ക് ജോലികൾക്ക് അപേക്ഷിക്കാം.',
      'Congratulations! You can now apply to gigs.');
  String get canApplyYes => _t('ജോലികൾക്ക് അപേക്ഷിക്കാം', 'You can apply to gigs');
  String get giverApprovedMsg => _t(
      'അഭിനന്ദനങ്ങൾ! ഇപ്പോൾ നിങ്ങൾക്ക് സുരക്ഷിതമായി ജോലികൾ പോസ്റ്റ് ചെയ്യാം.',
      'Congratulations! You can now post safe gigs.');
  String get canPostYes => _t('ജോലി പോസ്റ്റ് ചെയ്യാം', 'You can post gigs');
  String get manageMyGigs => _t('എന്റെ ജോലികൾ നിയന്ത്രിക്കുക', 'Manage my gigs');
  String get noMyGigs => _t('ഇപ്പോൾ നിങ്ങളുടെ ജോലികളില്ല', 'No gigs posted yet');
  String get viewApplicants => _t('അപേക്ഷകർ കാണുക', 'View applicants');
  String get applicants => _t('അപേക്ഷകർ', 'Applicants');
  String get noApplicants => _t('ഇപ്പോൾ അപേക്ഷകളില്ല', 'No applications yet');
  String get selectWorker => _t('തൊഴിലാളിയെ തിരഞ്ഞെടുക്കുക', 'Select worker');
  String get workerSelected => _t('തൊഴിലാളിയെ തിരഞ്ഞെടുത്തു', 'Worker selected');
  String get agreedAmount => _t('ഒപ്പുവെച്ച തുക', 'Agreed amount');
  String get postSafeGig => _t('സുരക്ഷിത ജോലി പോസ്റ്റ് ചെയ്യുക', 'Post a safe gig');
  String get category => _t('വിഭാഗം', 'Category');
  String get gigTitle => _t('ജോലിയുടെ പേര്', 'Gig title');
  String get gigDescription => _t('ജോലിയുടെ വിശദാംശങ്ങൾ', 'Gig details');
  String get gigLocation => _t('സ്ഥലം', 'Location');
  String get budgetInr => _t('ബജറ്റ് (₹)', 'Budget (₹)');
  String get fairPriceGuide => _t('ന്യായമായ നിരക്ക്', 'Fair price guide');
  String get submitGig => _t('ജോലി സമർപ്പിക്കുക', 'Submit gig');
  String get gigVisible => _t('ജോലി ലൈവായി', 'Gig is live');
  String get gigUnderReview => _t('സുരക്ഷാ പരിശോധനയ്ക്കായി പിടിച്ചിരിക്കുന്നു', 'Held for safety review');
  String get gigRejected => _t('സുരക്ഷാ നയപ്രകാരം നിരസിച്ചു', 'Rejected by safety policy');
  String get fillAllFields => _t('എല്ലാ വിവരങ്ങളും പൂരിപ്പിക്കുക', 'Fill all fields');
  String get browseSafeGigs => _t('സുരക്ഷിത ജോലികൾ കാണുക', 'Browse safe gigs');
  String get noGigs => _t('ഇപ്പോൾ ലൈവ് ജോലികളില്ല', 'No live gigs right now');
  String get apply => _t('അപേക്ഷിക്കുക', 'Apply');
  String get fairCounteroffer => _t('ന്യായമായ നിരക്ക് ചോദിക്കുക', 'Ask fair rate');
  String get proposedPrice => _t('നിങ്ങളുടെ നിരക്ക് (₹)', 'Your rate (₹)');
  String get applicationMessage => _t('നിങ്ങളുടെ സന്ദേശം', 'Your message');
  String get applicationSent => _t('അപേക്ഷ അയച്ചു', 'Application sent');
  String get reportUnsafe => _t('സുരക്ഷാ പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക', 'Report safety issue');
  String get reportReason => _t('കാരണം', 'Reason');
  String get reportDetails => _t('എന്താണ് സംഭവിച്ചത്?', 'What happened?');
  String get reportSent => _t('സുരക്ഷാ റിപ്പോർട്ട് അയച്ചു', 'Safety report sent');
  String get unsafeLocation => _t('സുരക്ഷിതമല്ലാത്ത സ്ഥലം', 'Unsafe location');
  String get harassment => _t('പീഡനം', 'Harassment');
  String get offPlatformPayment => _t('ആപ്പിന് പുറത്തുള്ള പണം', 'Off-platform payment');
  String get sexualMisconduct => _t('ലൈംഗിക ദുരുപയോഗം', 'Sexual misconduct');
  String get illegalActivity => _t('മയക്കുമരുന്ന് അല്ലെങ്കിൽ നിയമവിരുദ്ധ പ്രവർത്തനം', 'Drugs or illegal activity');
  String get violenceThreat => _t('അക്രമം അല്ലെങ്കിൽ ഭീഷണി', 'Violence or threat');
  String get fraud => _t('വഞ്ചന', 'Fraud');
  String get other => _t('മറ്റുള്ളവ', 'Other');

  // Generic
  String get next => _t('അടുത്തത്', 'Next');
  String get loading => _t('കാത്തിരിക്കൂ…', 'Please wait…');
  String get somethingWrong => _t('എന്തോ പിഴവ് സംഭവിച്ചു', 'Something went wrong');
}
