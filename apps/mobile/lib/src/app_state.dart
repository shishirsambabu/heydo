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
  String role = 'worker';
  String verificationStatus = 'unverified';
  bool canApply = false;
  bool canPost = false;
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> pricingGuides = [];
  Map<String, dynamic> proposalTokenPolicy = {
    'priceStepAmount': 500,
    'tokenUnitPriceAmount': 10,
    'currency': 'INR',
  };
  Map<String, dynamic>? proposalTokenBalance;
  List<Map<String, dynamic>> visibleGigs = [];
  List<Map<String, dynamic>> myGigs = [];
  List<Map<String, dynamic>> myApplications = [];
  List<Map<String, dynamic>> currentApplications = [];
  Map<String, Map<String, dynamic>> giverReputations = {};
  Map<String, Map<String, dynamic>> applicantReputations = {};
  Map<String, dynamic>? myReputation;
  Map<String, dynamic>? lastPostedGig;
  Map<String, dynamic>? lastApplication;
  Map<String, dynamic>? lastSelection;
  Map<String, dynamic>? lastGigTransition;
  Map<String, dynamic>? lastRating;
  Map<String, dynamic>? lastSafetyReport;

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
    } on HeydoNetworkException catch (e) {
      error = e.failure == HeydoNetworkFailure.timeout
          ? s.networkTimeout
          : s.networkUnavailable;
      return false;
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
      _guard(() async {
        role = 'worker';
        canPost = false;
        await api.selectRole('worker', name);
      });

  Future<bool> selectGiver(String name) =>
      _guard(() async {
        role = 'giver';
        canApply = false;
        await api.selectRole('giver', name);
      });

  Future<bool> consentAndStartVkyc() => _guard(() async {
        await api.consent();
        final locale = lang == Lang.ml ? 'ml' : 'en';
        final res = role == 'giver'
            ? await api.startGiverVkyc(locale)
            : await api.startVkyc(locale);
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

  Future<bool> loadMarketplaceSetup() => _guard(() async {
        final loadedCategories = await api.categories();
        final loadedGuides = await api.pricingGuides();
        final loadedProposalTokenPolicy = await api.proposalTokenPolicy();
        final loadedProposalTokenBalance = await api.proposalTokenBalance();
        categories = loadedCategories
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
        pricingGuides = loadedGuides
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
        proposalTokenPolicy = loadedProposalTokenPolicy;
        proposalTokenBalance = loadedProposalTokenBalance;
      });

  Map<String, dynamic>? pricingGuideFor(String categoryId) {
    for (final guide in pricingGuides) {
      if (guide['categoryId'] == categoryId) return guide;
    }
    return null;
  }

  Future<bool> postGig({
    required String categoryId,
    required String title,
    required String description,
    required String location,
    required int budgetAmount,
  }) =>
      _guard(() async {
        lastPostedGig = await api.postGig(
          categoryId: categoryId,
          title: title,
          description: description,
          location: location,
          scheduledAt: DateTime.now().add(const Duration(days: 1)).toUtc().toIso8601String(),
          budgetAmount: budgetAmount,
        );
      });

  Future<bool> loadVisibleGigs() => _guard(() async {
        final loaded = await api.gigs();
        visibleGigs = loaded
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
        giverReputations = {};
        final giverIds = visibleGigs
            .map((gig) => gig['giverId'])
            .whereType<String>()
            .toSet();
        for (final giverId in giverIds) {
          giverReputations[giverId] = await api.reputation(giverId);
        }
      });

  Future<bool> loadMyGigs() => _guard(() async {
        await _loadMyGigs();
      });

  Future<void> _loadMyGigs() async {
        final loaded = await api.myGigs();
        myGigs = loaded
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
  }

  Future<bool> loadMyApplications() => _guard(() async {
        await _loadMyApplications();
      });

  Future<void> _loadMyApplications() async {
        final loaded = await api.myApplications();
        myApplications = loaded
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
  }

  Future<bool> loadMyReputation() => _guard(() async {
        myReputation = await api.myReputation();
      });

  Future<bool> loadApplications(String gigId) => _guard(() async {
        final loaded = await api.applications(gigId);
        currentApplications = loaded
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
        applicantReputations = {};
        final workerIds = currentApplications
            .map((application) => application['workerId'])
            .whereType<String>()
            .toSet();
        for (final workerId in workerIds) {
          applicantReputations[workerId] = await api.reputation(workerId);
        }
      });

  Future<bool> applyToGig({
    required String gigId,
    String? messageMl,
    int? proposedPrice,
  }) =>
      _guard(() async {
        lastApplication = await api.applyToGig(
          gigId: gigId,
          messageMl: messageMl,
          proposedPrice: proposedPrice,
        );
        proposalTokenBalance = await api.proposalTokenBalance();
      });

  Future<bool> selectApplication({
    required String gigId,
    required String applicationId,
  }) =>
      _guard(() async {
        lastSelection = await api.selectApplication(
          gigId: gigId,
          applicationId: applicationId,
        );
      });

  Future<bool> startGig(String gigId) => _guard(() async {
        lastGigTransition = await api.startGig(gigId);
        await _loadMyApplications();
      });

  Future<bool> completeGig(String gigId) => _guard(() async {
        lastGigTransition = await api.completeGig(gigId);
        await _loadMyGigs();
      });

  Future<bool> cancelGig(String gigId, {required bool asWorker}) => _guard(() async {
        lastGigTransition = await api.cancelGig(gigId);
        if (asWorker) {
          await _loadMyApplications();
        } else {
          await _loadMyGigs();
        }
      });

  Future<bool> rateGig({
    required String gigId,
    required int stars,
    String? comment,
    required bool asWorker,
  }) =>
      _guard(() async {
        lastRating = await api.rateGig(
          gigId: gigId,
          stars: stars,
          comment: comment,
        );
        if (asWorker) {
          await _loadMyApplications();
        } else {
          await _loadMyGigs();
        }
      });

  Future<bool> raiseSafetyReport({
    required String gigId,
    required String reason,
    required String severity,
    required String description,
  }) =>
      _guard(() async {
        lastSafetyReport = await api.raiseSafetyReport(
          gigId: gigId,
          reason: reason,
          severity: severity,
          description: description,
        );
      });

  Future<void> _loadStatus() async {
    final res = role == 'giver'
        ? await api.giverVerificationStatus()
        : await api.verificationStatus();
    verificationStatus = (res['status'] as String?) ?? 'unverified';
    canApply = (res['canApply'] as bool?) ?? false;
    canPost = (res['canPost'] as bool?) ?? false;
  }
}
