import 'package:flutter/material.dart';

/// Accessibility-first building blocks (large targets, high contrast, clear text).
/// Colours come from the brand theme (HeydoColors). See .claude/rules/accessibility.md

class BigButton extends StatelessWidget {
  const BigButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.filled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(
            height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 24), const SizedBox(width: 10)],
              Flexible(
                child: Text(label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              ),
            ],
          );

    final style = ButtonStyle(
      minimumSize: WidgetStateProperty.all(const Size.fromHeight(58)), // big tap target
      shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    );

    return filled
        ? FilledButton(onPressed: busy ? null : onPressed, style: style, child: child)
        : OutlinedButton(onPressed: busy ? null : onPressed, style: style, child: child);
  }
}

class HeydoScaffold extends StatelessWidget {
  const HeydoScaffold({
    super.key,
    required this.title,
    required this.children,
    this.actions,
  });
  final String title;
  final List<Widget> children;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ),
    );
  }
}
