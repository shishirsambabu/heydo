import 'package:flutter/material.dart';

/// Heydo brand — the code expression of .claude/context/brand.md.
/// Single source of colour + type for the app. No off-palette colours.

class HeydoColors {
  HeydoColors._();

  static const heydoGreen = Color(0xFF1D9E75); // primary brand
  static const trustGreen = Color(0xFF0F6E56); // actions (contrast on white)
  static const deepForest = Color(0xFF04342C); // headings, app bars, dark
  static const mintSurface = Color(0xFFE1F5EE); // soft backgrounds, trust chips
  static const cleanWhite = Color(0xFFFFFFFF); // base surface
  static const richBlack = Color(0xFF1C1C1A); // body text, icons
}

class HeydoFonts {
  HeydoFonts._();
  static const display = 'PlusJakartaSans'; // Bold 800 for headings/brand
  static const body = 'Inter'; // 400 body, 500 labels
}

class HeydoTheme {
  HeydoTheme._();

  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: HeydoColors.trustGreen, // actions: best white-text contrast
      onPrimary: HeydoColors.cleanWhite,
      secondary: HeydoColors.heydoGreen, // brand accent
      onSecondary: HeydoColors.cleanWhite,
      tertiary: HeydoColors.deepForest,
      onTertiary: HeydoColors.cleanWhite,
      surface: HeydoColors.cleanWhite,
      onSurface: HeydoColors.richBlack,
      surfaceContainerHighest: HeydoColors.mintSurface,
      error: Color(0xFFB3261E),
      onError: HeydoColors.cleanWhite,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme);

    // Plus Jakarta Sans (800) for display/headline/title; Inter for body/label.
    final text = base.textTheme.copyWith(
      displayLarge: _jakarta(34),
      displayMedium: _jakarta(28),
      headlineLarge: _jakarta(26),
      headlineMedium: _jakarta(22),
      titleLarge: _jakarta(20),
      titleMedium: _inter(16, FontWeight.w500),
      bodyLarge: _inter(16, FontWeight.w400),
      bodyMedium: _inter(15, FontWeight.w400),
      labelLarge: _inter(15, FontWeight.w500),
      labelMedium: _inter(13, FontWeight.w500),
    );

    return base.copyWith(
      scaffoldBackgroundColor: HeydoColors.cleanWhite,
      textTheme: text,
      appBarTheme: const AppBarTheme(
        backgroundColor: HeydoColors.deepForest,
        foregroundColor: HeydoColors.cleanWhite,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontFamily: HeydoFonts.display,
          fontWeight: FontWeight.w800,
          fontSize: 20,
          color: HeydoColors.cleanWhite,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: HeydoColors.trustGreen,
          foregroundColor: HeydoColors.cleanWhite,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: HeydoColors.trustGreen,
          side: const BorderSide(color: HeydoColors.trustGreen, width: 1.5),
        ),
      ),
    );
  }

  static TextStyle _jakarta(double size) => TextStyle(
        fontFamily: HeydoFonts.display,
        fontWeight: FontWeight.w800,
        fontSize: size,
        color: HeydoColors.deepForest,
        height: 1.2,
      );

  static TextStyle _inter(double size, FontWeight weight) => TextStyle(
        fontFamily: HeydoFonts.body,
        fontWeight: weight,
        fontSize: size,
        color: HeydoColors.richBlack,
        height: 1.4,
      );
}
