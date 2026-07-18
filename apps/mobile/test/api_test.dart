import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:heydo/src/api.dart';
import 'package:heydo/src/app_state.dart';
import 'package:heydo/src/strings.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('HeydoApi low-connectivity behavior', () {
    test('retries a safe GET once after a transient network failure', () async {
      var requests = 0;
      final client = MockClient((request) async {
        requests++;
        if (requests == 1) {
          throw http.ClientException('temporarily offline', request.url);
        }
        return http.Response('[]', 200);
      });
      final api = HeydoApi(
        baseUrl: 'http://heydo.test',
        client: client,
        retryDelay: (_) async {},
      );

      expect(await api.categories(), isEmpty);
      expect(requests, 2);
    });

    test('loads and marks authenticated notifications without retrying writes',
        () async {
      final requests = <String>[];
      final client = MockClient((request) async {
        requests.add('${request.method} ${request.url.path}');
        if (request.method == 'GET' && request.url.path == '/notifications') {
          return http.Response(
            '[{"id":"ntf_1","titleMl":"അപേക്ഷ","titleEn":"Application","bodyMl":"പുതിയ വിവരം","bodyEn":"New update","readAt":null}]',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        if (request.method == 'GET' &&
            request.url.path == '/notifications/summary') {
          return http.Response('{"unreadCount":1}', 200);
        }
        if (request.method == 'POST' &&
            request.url.path == '/notifications/ntf_1/read') {
          return http.Response(
            '{"id":"ntf_1","titleMl":"അപേക്ഷ","titleEn":"Application","bodyMl":"പുതിയ വിവരം","bodyEn":"New update","readAt":"2026-07-18T10:00:00.000Z"}',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response('{}', 200);
      });
      final api = HeydoApi(baseUrl: 'http://heydo.test', client: client);
      final state = AppState(api: api);

      expect(await state.loadNotifications(), isTrue);
      expect(state.notifications, hasLength(1));
      expect(state.unreadNotificationCount, 1);

      expect(await state.markNotificationRead('ntf_1'), isTrue);
      expect(state.unreadNotificationCount, 0);
      expect(state.notifications.single['readAt'], isNotNull);
      expect(
        requests,
        [
          'GET /notifications',
          'GET /notifications/summary',
          'POST /notifications/ntf_1/read',
        ],
      );
    });

    test('registers and revokes a push device without retrying writes', () async {
      final calls = <String>[];
      final client = MockClient((request) async {
        calls.add('${request.method} ${request.url.path}');
        if (request.url.path == '/notifications/devices' && request.method == 'POST') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['token'], 'fcm-token-that-is-long-enough-for-validation');
          return http.Response(jsonEncode({'id': 'dev_1', 'platform': 'android', 'locale': 'ml', 'active': true}), 201);
        }
        if (request.url.path == '/notifications/devices/dev_1/revoke') {
          return http.Response(jsonEncode({'id': 'dev_1', 'active': false}), 201);
        }
        return http.Response('{}', 404);
      });
      final api = HeydoApi(baseUrl: 'http://test', client: client);

      final device = await api.registerPushDevice(platform: 'android', token: 'fcm-token-that-is-long-enough-for-validation', locale: 'ml');
      expect(device['id'], 'dev_1');
      expect((await api.revokePushDevice('dev_1'))['active'], isFalse);
      expect(calls, ['POST /notifications/devices', 'POST /notifications/devices/dev_1/revoke']);
    });

    test('never automatically retries a POST', () async {
      var requests = 0;
      final client = MockClient((request) async {
        requests++;
        throw http.ClientException('offline', request.url);
      });
      final api = HeydoApi(
        baseUrl: 'http://heydo.test',
        client: client,
        retryDelay: (_) async {},
      );

      await expectLater(
        api.postGig(
          categoryId: 'cat_1',
          title: 'Safe gig',
          description: 'Clear lawful work',
          location: 'Kochi',
          scheduledAt: '2026-07-18T10:00:00.000Z',
          budgetAmount: 1200,
        ),
        throwsA(
          isA<HeydoNetworkException>().having(
            (error) => error.failure,
            'failure',
            HeydoNetworkFailure.unavailable,
          ),
        ),
      );
      expect(requests, 1);
    });

    test('turns a stalled request into a timeout failure', () async {
      final client = MockClient(
        (_) => Completer<http.Response>().future,
      );
      final api = HeydoApi(
        baseUrl: 'http://heydo.test',
        client: client,
        requestTimeout: const Duration(milliseconds: 5),
        safeGetRetries: 0,
      );

      await expectLater(
        api.categories(),
        throwsA(
          isA<HeydoNetworkException>().having(
            (error) => error.failure,
            'failure',
            HeydoNetworkFailure.timeout,
          ),
        ),
      );
    });

    test('surfaces network failure guidance in the selected language',
        () async {
      final client = MockClient((request) async {
        throw http.ClientException('offline', request.url);
      });
      final api = HeydoApi(
        baseUrl: 'http://heydo.test',
        client: client,
        retryDelay: (_) async {},
      );
      final state = AppState(api: api)..setLang(Lang.en);

      expect(await state.loadVisibleGigs(), isFalse);
      expect(state.error, S(Lang.en).networkUnavailable);

      state.setLang(Lang.ml);
      expect(await state.loadVisibleGigs(), isFalse);
      expect(state.error, S(Lang.ml).networkUnavailable);
    });
  });
}
