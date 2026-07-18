import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

abstract class PushNotifications {
  Future<String?> initialize();
  Stream<String> get tokenRefreshes;
  Stream<void> get foregroundMessages;
}

class DisabledPushNotifications implements PushNotifications {
  const DisabledPushNotifications();

  @override
  Future<String?> initialize() async => null;

  @override
  Stream<void> get foregroundMessages => const Stream.empty();

  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
}

/// Firebase stays off until the app is authenticated and explicitly built with
/// HEYDO_FIREBASE_ENABLED=true. Client IDs are configuration, never secrets.
class FirebasePushNotifications implements PushNotifications {
  static const _enabled = bool.fromEnvironment(
    'HEYDO_FIREBASE_ENABLED',
    defaultValue: false,
  );
  static const _apiKey = String.fromEnvironment('HEYDO_FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('HEYDO_FIREBASE_APP_ID');
  static const _senderId =
      String.fromEnvironment('HEYDO_FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('HEYDO_FIREBASE_PROJECT_ID');
  static const _storageBucket =
      String.fromEnvironment('HEYDO_FIREBASE_STORAGE_BUCKET');

  bool _initialized = false;

  bool get _supported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  @override
  Future<String?> initialize() async {
    if (!_enabled || !_supported) return null;
    if (!_initialized) {
      if ([_apiKey, _appId, _senderId, _projectId]
          .any((value) => value.isEmpty)) {
        throw StateError('Firebase push configuration is incomplete.');
      }
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: _apiKey,
          appId: _appId,
          messagingSenderId: _senderId,
          projectId: _projectId,
          storageBucket: _storageBucket.isEmpty ? null : _storageBucket,
        ),
      );
      await FirebaseMessaging.instance.setAutoInitEnabled(true);
      _initialized = true;
    }

    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    if (permission.authorizationStatus == AuthorizationStatus.denied) {
      return null;
    }
    return FirebaseMessaging.instance.getToken();
  }

  @override
  Stream<void> get foregroundMessages => _initialized
      ? FirebaseMessaging.onMessage.map<void>((_) {})
      : const Stream.empty();

  @override
  Stream<String> get tokenRefreshes => _initialized
      ? FirebaseMessaging.instance.onTokenRefresh
      : const Stream.empty();
}
