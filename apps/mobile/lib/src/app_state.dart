import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'strings.dart';

/// Single source of onboarding state. Phase 1 keeps it deliberately small
/// (Provider/ChangeNotifier). The real app layers richer state management.
class AppState extends ChangeNotifier {
  AppState({HeydoApi? api, DateTime Function()? now})
      : api = api ?? HeydoApi(),
        _now = now ?? DateTime.now;

  final HeydoApi api;
  final DateTime Function() _now;

  static const _langKey = 'heydo_lang';
  static const _marketplaceSetupCacheKey = 'heydo_public_marketplace_setup_v1';
  static const _visibleGigsCacheKey = 'heydo_public_visible_gigs_v1';
  static const _marketplaceSetupCacheLifetime = Duration(days: 7);
  static const _visibleGigsCacheLifetime = Duration(minutes: 15);

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
  List<Map<String, dynamic>> notifications = [];
  int unreadNotificationCount = 0;
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
  bool showingCachedMarketplace = false;

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

  Future<bool> selectWorker(String name) => _guard(() async {
        role = 'worker';
        canPost = false;
        await api.selectRole('worker', name);
      });

  Future<bool> selectGiver(String name) => _guard(() async {
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
        try {
          final loadedCategories = await api.categories();
          final loadedGuides = await api.pricingGuides();
          final loadedProposalTokenPolicy = await api.proposalTokenPolicy();
          final loadedProposalTokenBalance = await api.proposalTokenBalance();
          categories = _maps(loadedCategories);
          pricingGuides = _maps(loadedGuides);
          proposalTokenPolicy = loadedProposalTokenPolicy;
          proposalTokenBalance = loadedProposalTokenBalance;
          showingCachedMarketplace = false;
          await _saveMarketplaceSetupCache();
        } on HeydoNetworkException {
          if (!await _restoreMarketplaceSetupCache()) rethrow;
          showingCachedMarketplace = true;
          proposalTokenBalance = null;
        }
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
          scheduledAt: DateTime.now()
              .add(const Duration(days: 1))
              .toUtc()
              .toIso8601String(),
          budgetAmount: budgetAmount,
        );
      });

  Future<bool> loadVisibleGigs() => _guard(() async {
        try {
          final loaded = await api.gigs();
          visibleGigs = _maps(loaded);
          giverReputations = {};
          final giverIds = visibleGigs
              .map((gig) => gig['giverId'])
              .whereType<String>()
              .toSet();
          for (final giverId in giverIds) {
            giverReputations[giverId] = await api.reputation(giverId);
          }
          showingCachedMarketplace = false;
          await _saveVisibleGigsCache();
        } on HeydoNetworkException {
          if (!await _restoreVisibleGigsCache()) rethrow;
          showingCachedMarketplace = true;
        }
      });

  List<Map<String, dynamic>> _maps(Iterable<dynamic> values) => values
      .whereType<Map<String, dynamic>>()
      .map(Map<String, dynamic>.from)
      .toList(growable: false);

  Future<void> _saveMarketplaceSetupCache() => _savePublicCache(
        _marketplaceSetupCacheKey,
        {
          'savedAt': _now().toUtc().toIso8601String(),
          'categories': categories
              .map((value) => _selectFields(value, const [
                    'id',
                    'nameMl',
                    'nameEn',
                  ]))
              .toList(growable: false),
          'pricingGuides': pricingGuides
              .map((value) => _selectFields(value, const [
                    'categoryId',
                    'minBudgetAmount',
                    'suggestedBudgetAmount',
                    'highReviewAmount',
                    'notes',
                  ]))
              .toList(growable: false),
          'proposalTokenPolicy': _selectFields(
            proposalTokenPolicy,
            const [
              'priceStepAmount',
              'tokenUnitPriceAmount',
              'currency',
            ],
          ),
        },
      );

  Future<void> _saveVisibleGigsCache() => _savePublicCache(
        _visibleGigsCacheKey,
        {
          'savedAt': _now().toUtc().toIso8601String(),
          'visibleGigs': visibleGigs
              .map((value) => _selectFields(value, const [
                    'id',
                    'giverId',
                    'categoryId',
                    'title',
                    'description',
                    'location',
                    'scheduledAt',
                    'budgetAmount',
                    'currency',
                  ]))
              .toList(growable: false),
          'giverReputations': giverReputations.map((giverId, value) {
            final asGiver = value['asGiver'];
            return MapEntry(giverId, {
              'asGiver': asGiver is Map
                  ? _selectFields(
                      Map<String, dynamic>.from(asGiver),
                      const ['heydoScore', 'averageStars', 'ratingCount'],
                    )
                  : <String, dynamic>{},
            });
          }),
        },
      );

  Map<String, dynamic> _selectFields(
    Map<String, dynamic> source,
    List<String> fields,
  ) =>
      {
        for (final field in fields)
          if (source.containsKey(field)) field: source[field],
      };

  Future<void> _savePublicCache(String key, Map<String, dynamic> value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(value));
    } catch (_) {
      // Allowlisted public read cache is best-effort and never blocks live flow.
    }
  }

  Future<bool> _restoreMarketplaceSetupCache() async {
    final cached = await _readFreshPublicCache(
      _marketplaceSetupCacheKey,
      _marketplaceSetupCacheLifetime,
    );
    if (cached == null) return false;
    final loadedCategories = cached['categories'];
    final loadedGuides = cached['pricingGuides'];
    final loadedPolicy = cached['proposalTokenPolicy'];
    if (loadedCategories is! List ||
        loadedGuides is! List ||
        loadedPolicy is! Map) {
      return false;
    }
    categories = _maps(loadedCategories);
    pricingGuides = _maps(loadedGuides);
    proposalTokenPolicy = Map<String, dynamic>.from(loadedPolicy);
    return true;
  }

  Future<bool> _restoreVisibleGigsCache() async {
    final cached = await _readFreshPublicCache(
      _visibleGigsCacheKey,
      _visibleGigsCacheLifetime,
    );
    if (cached == null) return false;
    final loadedGigs = cached['visibleGigs'];
    final loadedReputations = cached['giverReputations'];
    if (loadedGigs is! List || loadedReputations is! Map) return false;
    visibleGigs = _maps(loadedGigs);
    giverReputations = loadedReputations.map(
      (key, value) => MapEntry(
        key.toString(),
        value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{},
      ),
    );
    return true;
  }

  Future<Map<String, dynamic>?> _readFreshPublicCache(
    String key,
    Duration lifetime,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final cache = Map<String, dynamic>.from(decoded);
      final savedAt = DateTime.tryParse(cache['savedAt'] as String? ?? '');
      final age = savedAt == null ? null : _now().toUtc().difference(savedAt);
      if (age == null || age.isNegative || age > lifetime) {
        await prefs.remove(key);
        return null;
      }
      return cache;
    } catch (_) {
      return null;
    }
  }

  Future<bool> loadMyGigs() => _guard(() async {
        await _loadMyGigs();
      });

  Future<void> _loadMyGigs() async {
    final loaded = await api.myGigs();
    myGigs = loaded.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  Future<bool> loadMyApplications() => _guard(() async {
        await _loadMyApplications();
      });

  Future<void> _loadMyApplications() async {
    final loaded = await api.myApplications();
    myApplications =
        loaded.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  Future<bool> loadMyReputation() => _guard(() async {
        myReputation = await api.myReputation();
      });

  Future<bool> loadApplications(String gigId) => _guard(() async {
        final loaded = await api.applications(gigId);
        currentApplications =
            loaded.whereType<Map<String, dynamic>>().toList(growable: false);
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

  Future<bool> cancelGig(String gigId, {required bool asWorker}) =>
      _guard(() async {
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

  Future<bool> loadNotifications() => _guard(() async {
        notifications = _maps(await api.notifications());
        await _loadNotificationSummary();
      });

  Future<bool> markNotificationRead(String notificationId) => _guard(() async {
        final updated = await api.markNotificationRead(notificationId);
        notifications = notifications
            .map((notification) => notification['id'] == notificationId
                ? Map<String, dynamic>.from(updated)
                : notification)
            .toList(growable: false);
        unreadNotificationCount = notifications
            .where((notification) => notification['readAt'] == null)
            .length;
      });

  Future<bool> markAllNotificationsRead() => _guard(() async {
        await api.markAllNotificationsRead();
        final readAt = _now().toUtc().toIso8601String();
        notifications = notifications
            .map((notification) => {
                  ...notification,
                  'readAt': notification['readAt'] ?? readAt,
                })
            .toList(growable: false);
        unreadNotificationCount = 0;
      });

  Future<void> _loadNotificationSummary() async {
    final summary = await api.notificationSummary();
    unreadNotificationCount = (summary['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> _loadStatus() async {
    final res = role == 'giver'
        ? await api.giverVerificationStatus()
        : await api.verificationStatus();
    verificationStatus = (res['status'] as String?) ?? 'unverified';
    canApply = (res['canApply'] as bool?) ?? false;
    canPost = (res['canPost'] as bool?) ?? false;
    if (canApply || canPost) {
      try {
        await _loadNotificationSummary();
      } catch (_) {
        // Notification availability must never block the identity gate.
      }
    }
  }
}
