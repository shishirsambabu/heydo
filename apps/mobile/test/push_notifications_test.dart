import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:heydo/src/api.dart';
import 'package:heydo/src/app_state.dart';
import 'package:heydo/src/push_notifications.dart';
import 'package:heydo/src/strings.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class FakePushNotifications implements PushNotifications {
  FakePushNotifications({
    this.initialToken,
    this.initializationError,
    this.initialNotificationOpen = false,
  });

  final String? initialToken;
  final Object? initializationError;
  bool initialNotificationOpen;
  final tokenController = StreamController<String>.broadcast();
  final messageController = StreamController<void>.broadcast();
  final openController = StreamController<void>.broadcast();

  @override
  Future<bool> consumeInitialNotificationOpen() async {
    final opened = initialNotificationOpen;
    initialNotificationOpen = false;
    return opened;
  }

  @override
  Stream<void> get foregroundMessages => messageController.stream;

  @override
  Stream<void> get notificationOpens => openController.stream;

  @override
  Future<String?> initialize() async {
    if (initializationError != null) throw initializationError!;
    return initialToken;
  }

  @override
  Stream<String> get tokenRefreshes => tokenController.stream;

  Future<void> close() async {
    await tokenController.close();
    await messageController.close();
    await openController.close();
  }
}

Future<void> settleAsyncWork() async {
  for (var i = 0; i < 8; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  test('registers authenticated token, rotation, locale, and inbox refresh',
      () async {
    final registrations = <Map<String, dynamic>>[];
    var notificationReads = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/auth/otp/verify') {
        return http.Response('{"token":"heydo-access-token"}', 201);
      }
      if (request.url.path == '/notifications/devices') {
        registrations.add(
          Map<String, dynamic>.from(jsonDecode(request.body) as Map),
        );
        return http.Response('{"id":"device-1","active":true}', 201);
      }
      if (request.url.path == '/notifications') {
        notificationReads++;
        return http.Response(
          '[{"id":"notice-1","readAt":null}]',
          200,
        );
      }
      if (request.url.path == '/notifications/summary') {
        return http.Response('{"unreadCount":1}', 200);
      }
      return http.Response('{}', 404);
    });
    final push = FakePushNotifications(initialToken: 'initial-fcm-token');
    final state = AppState(
      api: HeydoApi(baseUrl: 'http://heydo.test', client: client),
      pushNotifications: push,
    );

    expect(await state.verifyOtp('123456'), isTrue);
    await settleAsyncWork();
    expect(registrations, hasLength(1));
    expect(registrations.single['token'], 'initial-fcm-token');
    expect(registrations.single['locale'], 'ml');

    push.tokenController.add('rotated-fcm-token');
    await settleAsyncWork();
    expect(registrations.last['token'], 'rotated-fcm-token');

    state.setLang(Lang.en);
    await settleAsyncWork();
    expect(registrations.last['locale'], 'en');
    expect(registrations.last['token'], 'rotated-fcm-token');

    push.messageController.add(null);
    await settleAsyncWork();
    expect(notificationReads, 1);
    expect(state.unreadNotificationCount, 1);

    push.openController.add(null);
    await settleAsyncWork();
    expect(notificationReads, 2);
    expect(state.notificationOpenSequence, 1);

    state.dispose();
    await push.close();
  });

  test('consumes a terminated-state notification open only once', () async {
    var notificationReads = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/auth/otp/verify') {
        return http.Response('{"token":"heydo-access-token"}', 201);
      }
      if (request.url.path == '/notifications') {
        notificationReads++;
        return http.Response('[]', 200);
      }
      if (request.url.path == '/notifications/summary') {
        return http.Response('{"unreadCount":0}', 200);
      }
      return http.Response('{}', 404);
    });
    final push = FakePushNotifications(initialNotificationOpen: true);
    final state = AppState(
      api: HeydoApi(baseUrl: 'http://heydo.test', client: client),
      pushNotifications: push,
    );

    expect(await state.verifyOtp('123456'), isTrue);
    await settleAsyncWork();
    expect(notificationReads, 1);
    expect(state.notificationOpenSequence, 1);
    expect(await push.consumeInitialNotificationOpen(), isFalse);

    state.dispose();
    await push.close();
  });

  test('push initialization failure never blocks OTP login', () async {
    final client = MockClient((request) async =>
        http.Response('{"token":"heydo-access-token"}', 201));
    final push = FakePushNotifications(
      initializationError: StateError('Firebase unavailable'),
    );
    final state = AppState(
      api: HeydoApi(baseUrl: 'http://heydo.test', client: client),
      pushNotifications: push,
    );

    expect(await state.verifyOtp('123456'), isTrue);
    await settleAsyncWork();
    expect(state.error, isNull);

    state.dispose();
    await push.close();
  });
}
