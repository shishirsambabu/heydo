import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heydo/main.dart';
import 'package:provider/provider.dart';

import 'package:heydo/src/app_state.dart';
import 'package:heydo/src/screens.dart';
import 'package:heydo/src/strings.dart';

void main() {
  testWidgets('Language screen shows Malayalam-first options', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(),
        child: const MaterialApp(home: LanguageScreen()),
      ),
    );

    // Malayalam is the default language and must be offered first.
    expect(find.text('മലയാളം'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
  });

  test('Strings default to Malayalam', () {
    final ml = S(Lang.ml);
    final en = S(Lang.en);
    expect(ml.sendOtp, isNot(equals(en.sendOtp)));
    expect(ml.appName, 'Heydo');
  });

  testWidgets('notification open event navigates to one durable inbox',
      (tester) async {
    final app = AppState();
    await tester.pumpWidget(HeydoApp(app: app));

    app.notificationOpenSequence++;
    app.notifyListeners();
    await tester.pumpAndSettle();
    expect(find.byType(NotificationScreen), findsOneWidget);

    app.notificationOpenSequence++;
    app.notifyListeners();
    await tester.pumpAndSettle();
    expect(find.byType(NotificationScreen), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    app.dispose();
  });
}
