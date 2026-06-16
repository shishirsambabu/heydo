import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'strings.dart';

/// Single source of onboarding state. Phase 1 keeps it deliberately small
/// (Provider/ChangeNotifier). The real app layers richer state management.
class AppState extends ChangeNotifier {
  AppState({HeydoApi? api}) : api = api ?? HeydoApi();

  final HeydoApi api;

  static const _langKey = 'heydo_lang';

  Lang lang = Lang.ml; // Malayalam-first default
  bool initialized = false;
  S get s => S(lang);

  /// Load the user's saved language choice (called once at startup).
  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      lang = prefs.getString(_langKey) == 'en' ? Lang.en : Lang.ml;
    } catch (_) {
      // No prefs available (e.g. tests) — keep the Malayalam-first default.
    }
    initialized = true;
    notifyListeners();
  }

  String phone = '';
  String? devCode; // dev only (mock SMS surfaces the code)
  String? sessionId;
  String verificationStatus = 'unverified';
  bool canApply = false;

  bool busy = false;
  String? error;

  /// Set + persist the language choice, so the app remembers it next launch.
  void setLang(Lang l) {
    lang = l;
    notifyListeners();
    _persistLang(l);
  }

  Future<void> _persistLang(Lang l) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_langKey, l == Lang.en ? 'en' : 'ml');
    } catch (_) {
      // Persistence is best-effort; never block the UI on it.
    }
  }

  Future<bool> _guard(Future<void> Function() action) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
      return true;
    } on HeydoApiException catch (e) {
      error = 'Error ${e.status}';
      return false;
    } catch (_) {
      error = s.somethingWrong;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> requestOtp(String enteredPhone) => _guard(() async {
        phone = enteredPhone;
        final res = await api.requestOtp(enteredPhone);
        devCode = res['devCode'] as String?;
      });

  Future<bool> verifyOtp(String code) => _guard(() async {
        final res = await api.verifyOtp(phone, code);
        api.setToken(res['token'] as String);
      });

  Future<bool> selectWorker(String name) =>
      _guard(() async => await api.selectRole('worker', name));

  Future<bool> consentAndStartVkyc() => _guard(() async {
        await api.consent();
        final res = await api.startVkyc(lang == Lang.ml ? 'ml' : 'en');
        sessionId = res['sessionId'] as String?;
      });

  /// Dev: simulate the vendor result so the demo flow can reach "under review".
  Future<bool> completeVkycDemo() => _guard(() async {
        if (sessionId != null) {
          await api.submitVkycResult(sessionId!);
        }
        await _loadStatus();
      });

  Future<bool> refreshStatus() => _guard(_loadStatus);

  Future<void> _loadStatus() async {
    final res = await api.verificationStatus();
    verificationStatus = (res['status'] as String?) ?? 'unverified';
    canApply = (res['canApply'] as bool?) ?? false;
  }
}
