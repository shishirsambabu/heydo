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

  // Generic
  String get next => _t('അടുത്തത്', 'Next');
  String get loading => _t('കാത്തിരിക്കൂ…', 'Please wait…');
  String get somethingWrong => _t('എന്തോ പിഴവ് സംഭവിച്ചു', 'Something went wrong');
}
