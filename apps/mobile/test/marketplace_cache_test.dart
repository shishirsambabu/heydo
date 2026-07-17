import 'package:flutter_test/flutter_test.dart';
import 'package:heydo/src/api.dart';
import 'package:heydo/src/app_state.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final cachedAt = DateTime.utc(2026, 7, 17, 10);

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('uses fresh cached public marketplace setup while offline', () async {
    final online = AppState(
      api: HeydoApi(
        baseUrl: 'http://heydo.test',
        client: MockClient((request) async {
          return switch (request.url.path) {
            '/marketplace/categories' => http.Response(
                '[{"id":"cat_1","nameMl":"Veedu joli","internalNotes":"do not cache"}]',
                200,
              ),
            '/marketplace/pricing-guides' => http.Response(
                '[{"categoryId":"cat_1","minBudgetAmount":500}]',
                200,
              ),
            '/marketplace/proposal-token-policy' => http.Response(
                '{"priceStepAmount":500,"currency":"INR","adminPrice":99}',
                200,
              ),
            '/marketplace/proposal-token-balance' => http.Response(
                '{"balance":3}',
                200,
              ),
            _ => http.Response('Not found', 404),
          };
        }),
      ),
      now: () => cachedAt,
    );

    final loadedOnline = await online.loadMarketplaceSetup();
    expect(loadedOnline, isTrue, reason: online.error);
    expect(online.showingCachedMarketplace, isFalse);

    final offline = AppState(
      api: _offlineApi(),
      now: () => cachedAt.add(const Duration(hours: 1)),
    );
    expect(await offline.loadMarketplaceSetup(), isTrue);
    expect(offline.showingCachedMarketplace, isTrue);
    expect(offline.categories.single['id'], 'cat_1');
    expect(offline.categories.single.containsKey('internalNotes'), isFalse);
    expect(offline.pricingGuides.single['categoryId'], 'cat_1');
    expect(offline.proposalTokenPolicy.containsKey('adminPrice'), isFalse);
    expect(offline.proposalTokenBalance, isNull);
  });

  test('uses public gig and reputation cache for at most 15 minutes', () async {
    final online = AppState(
      api: HeydoApi(
        baseUrl: 'http://heydo.test',
        client: MockClient((request) async {
          return switch (request.url.path) {
            '/marketplace/gigs' => http.Response(
                '[{"id":"gig_1","giverId":"giver_1","title":"Safe gig","phone":"9999999999","exactAddress":"private"}]',
                200,
              ),
            '/marketplace/reputation/giver_1' => http.Response(
                '{"asGiver":{"heydoScore":82,"ratingCount":4,"email":"private@example.test"},"identity":"private"}',
                200,
              ),
            _ => http.Response('Not found', 404),
          };
        }),
      ),
      now: () => cachedAt,
    );
    expect(await online.loadVisibleGigs(), isTrue);

    final freshOffline = AppState(
      api: _offlineApi(),
      now: () => cachedAt.add(const Duration(minutes: 14)),
    );
    expect(await freshOffline.loadVisibleGigs(), isTrue);
    expect(freshOffline.showingCachedMarketplace, isTrue);
    expect(freshOffline.visibleGigs.single['id'], 'gig_1');
    expect(freshOffline.visibleGigs.single.containsKey('phone'), isFalse);
    expect(
        freshOffline.visibleGigs.single.containsKey('exactAddress'), isFalse);
    final cachedReputation = freshOffline.giverReputations['giver_1']!;
    expect(cachedReputation.containsKey('identity'), isFalse);
    expect(cachedReputation['asGiver']['heydoScore'], 82);
    expect(cachedReputation['asGiver'].containsKey('email'), isFalse);

    final staleOffline = AppState(
      api: _offlineApi(),
      now: () => cachedAt.add(const Duration(minutes: 16)),
    );
    expect(await staleOffline.loadVisibleGigs(), isFalse);
    expect(staleOffline.showingCachedMarketplace, isFalse);
    expect(staleOffline.visibleGigs, isEmpty);
  });

  test('rejects a public cache timestamp from the future', () async {
    SharedPreferences.setMockInitialValues({
      'heydo_public_visible_gigs_v1':
          '{"savedAt":"2026-07-17T10:05:00.000Z","visibleGigs":[],"giverReputations":{}}',
    });
    final offline = AppState(api: _offlineApi(), now: () => cachedAt);

    expect(await offline.loadVisibleGigs(), isFalse);
    expect(offline.showingCachedMarketplace, isFalse);

    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getString('heydo_public_visible_gigs_v1'), isNull);
  });
}

HeydoApi _offlineApi() => HeydoApi(
      baseUrl: 'http://heydo.test',
      client: MockClient((request) async {
        throw http.ClientException('offline', request.url);
      }),
      retryDelay: (_) async {},
    );
