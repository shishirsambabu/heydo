import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/app_state.dart';
import 'src/screens.dart';
import 'src/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final app = AppState();
  app.init(); // load the saved language choice (Malayalam-first by default)
  runApp(HeydoApp(app: app));
}

class HeydoApp extends StatelessWidget {
  const HeydoApp({super.key, required this.app});

  final AppState app;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: app,
      child: MaterialApp(
        title: 'Heydo',
        debugShowCheckedModeBanner: false,
        theme: HeydoTheme.light(),
        home: const LanguageScreen(),
      ),
    );
  }
}
