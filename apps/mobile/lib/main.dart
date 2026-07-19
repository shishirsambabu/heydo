import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/app_state.dart';
import 'src/push_notifications.dart';
import 'src/screens.dart';
import 'src/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final app = AppState(pushNotifications: FirebasePushNotifications());
  app.init(); // load the saved language choice (Malayalam-first by default)
  runApp(HeydoApp(app: app));
}

class HeydoApp extends StatefulWidget {
  const HeydoApp({super.key, required this.app});

  final AppState app;

  @override
  State<HeydoApp> createState() => _HeydoAppState();
}

class _HeydoAppState extends State<HeydoApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  int _handledNotificationOpen = 0;
  bool _notificationScreenOpen = false;

  @override
  void initState() {
    super.initState();
    widget.app.addListener(_handleAppState);
  }

  @override
  void didUpdateWidget(covariant HeydoApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.app == widget.app) return;
    oldWidget.app.removeListener(_handleAppState);
    widget.app.addListener(_handleAppState);
  }

  void _handleAppState() {
    final sequence = widget.app.notificationOpenSequence;
    if (sequence <= _handledNotificationOpen) return;
    _handledNotificationOpen = sequence;
    if (_notificationScreenOpen) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final navigator = _navigatorKey.currentState;
      if (!mounted || navigator == null || _notificationScreenOpen) return;
      _notificationScreenOpen = true;
      navigator
          .push(MaterialPageRoute(builder: (_) => const NotificationScreen()))
          .whenComplete(() => _notificationScreenOpen = false);
    });
  }

  @override
  void dispose() {
    widget.app.removeListener(_handleAppState);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: widget.app,
      child: MaterialApp(
        navigatorKey: _navigatorKey,
        title: 'Heydo',
        debugShowCheckedModeBanner: false,
        theme: HeydoTheme.light(),
        home: const LanguageScreen(),
      ),
    );
  }
}
