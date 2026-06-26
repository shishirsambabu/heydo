import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Thin client over the Heydo backend (the NestJS API we built in Phase 1).
///
/// Base URL is chosen per platform:
///  - Web / Windows / iOS sim / desktop → http://localhost:3000
///  - Android emulator                  → http://10.0.2.2:3000 (maps to host localhost)
///  - Physical phone                    → pass baseUrl = your PC's LAN IP
String defaultApiBase() {
  if (kIsWeb) return 'http://localhost:3000';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

class HeydoApi {
  HeydoApi({String? baseUrl}) : baseUrl = baseUrl ?? defaultApiBase();

  final String baseUrl;
  String? _token;

  void setToken(String token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> _post(String path, [Map<String, dynamic>? body]) async {
    final res = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body ?? {}),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    return _decode(res);
  }

  Future<List<dynamic>> _getList(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (res.statusCode >= 400) {
      throw HeydoApiException(res.statusCode, res.body);
    }
    if (res.body.isEmpty) return [];
    final decoded = jsonDecode(res.body);
    return decoded is List<dynamic> ? decoded : [];
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode >= 400) {
      throw HeydoApiException(res.statusCode, res.body);
    }
    if (res.body.isEmpty) return {};
    final decoded = jsonDecode(res.body);
    return decoded is Map<String, dynamic> ? decoded : {'data': decoded};
  }

  // --- Auth ---
  Future<Map<String, dynamic>> requestOtp(String phone) =>
      _post('/auth/otp/request', {'phone': phone});

  Future<Map<String, dynamic>> verifyOtp(String phone, String code) =>
      _post('/auth/otp/verify', {'phone': phone, 'code': code});

  // --- Identity ---
  Future<Map<String, dynamic>> selectRole(String role, String displayName) =>
      _post('/identity/role', {'role': role, 'displayName': displayName});

  // --- Verification (VKYC) ---
  Future<Map<String, dynamic>> consent() => _post('/verification/consent');
  Future<Map<String, dynamic>> startVkyc(String locale) =>
      _post('/verification/start', {'locale': locale});
  Future<Map<String, dynamic>> startGiverVkyc(String locale) =>
      _post('/verification/giver/start', {'locale': locale});
  // Dev-only: simulate the vendor result callback.
  Future<Map<String, dynamic>> submitVkycResult(String sessionId) =>
      _post('/verification/result', {'sessionId': sessionId});
  Future<Map<String, dynamic>> verificationStatus() => _get('/verification/status');
  Future<Map<String, dynamic>> giverVerificationStatus() => _get('/verification/giver/status');

  // --- Marketplace ---
  Future<List<dynamic>> categories() => _getList('/marketplace/categories');
  Future<List<dynamic>> pricingGuides() => _getList('/marketplace/pricing-guides');
  Future<Map<String, dynamic>> proposalTokenPolicy() =>
      _get('/marketplace/proposal-token-policy');
  Future<Map<String, dynamic>> proposalTokenBalance() =>
      _get('/marketplace/proposal-token-balance');
  Future<Map<String, dynamic>> postGig({
    required String categoryId,
    required String title,
    required String description,
    required String location,
    required String scheduledAt,
    required int budgetAmount,
  }) =>
      _post('/marketplace/gigs', {
        'categoryId': categoryId,
        'title': title,
        'description': description,
        'location': location,
        'scheduledAt': scheduledAt,
        'budgetAmount': budgetAmount,
      });
  Future<List<dynamic>> gigs() => _getList('/marketplace/gigs');
  Future<List<dynamic>> myGigs() => _getList('/marketplace/my-gigs');
  Future<List<dynamic>> myApplications() => _getList('/marketplace/my-applications');
  Future<Map<String, dynamic>> myReputation() => _get('/marketplace/my-reputation');
  Future<Map<String, dynamic>> reputation(String userId) =>
      _get('/marketplace/reputation/$userId');
  Future<List<dynamic>> applications(String gigId) =>
      _getList('/marketplace/gigs/$gigId/applications');
  Future<Map<String, dynamic>> applyToGig({
    required String gigId,
    String? messageMl,
    int? proposedPrice,
  }) =>
      _post('/marketplace/gigs/$gigId/applications', {
        if (messageMl != null && messageMl.trim().isNotEmpty) 'messageMl': messageMl.trim(),
        if (proposedPrice != null) 'proposedPrice': proposedPrice,
      });
  Future<Map<String, dynamic>> selectApplication({
    required String gigId,
    required String applicationId,
  }) =>
      _post('/marketplace/gigs/$gigId/applications/$applicationId/select');
  Future<Map<String, dynamic>> startGig(String gigId) =>
      _post('/marketplace/gigs/$gigId/start');
  Future<Map<String, dynamic>> completeGig(String gigId) =>
      _post('/marketplace/gigs/$gigId/complete');
  Future<Map<String, dynamic>> cancelGig(String gigId) =>
      _post('/marketplace/gigs/$gigId/cancel');
  Future<Map<String, dynamic>> rateGig({
    required String gigId,
    required int stars,
    String? comment,
  }) =>
      _post('/marketplace/gigs/$gigId/ratings', {
        'stars': stars,
        if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
      });
  Future<Map<String, dynamic>> raiseSafetyReport({
    required String gigId,
    required String reason,
    required String severity,
    required String description,
  }) =>
      _post('/marketplace/gigs/$gigId/safety-reports', {
        'reason': reason,
        'severity': severity,
        'description': description,
      });
}

class HeydoApiException implements Exception {
  HeydoApiException(this.status, this.body);
  final int status;
  final String body;
  @override
  String toString() => 'HeydoApiException($status): $body';
}
