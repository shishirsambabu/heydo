import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_state.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

/// The Phase 1 onboarding flow:
/// language -> phone -> OTP -> role -> consent + VKYC -> status.

/// App-bar control to switch language anytime; the choice is persisted.
class LanguageToggle extends StatelessWidget {
  const LanguageToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return TextButton.icon(
      onPressed: () =>
          context.read<AppState>().setLang(app.lang == Lang.ml ? Lang.en : Lang.ml),
      icon: const Icon(Icons.translate, color: Colors.white, size: 20),
      label: Text(
        app.lang == Lang.ml ? 'EN' : 'മല',
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.appName,
      children: [
        const SizedBox(height: 20),
        Text(
          s.tagline,
          style: const TextStyle(
            fontFamily: HeydoFonts.display,
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: HeydoColors.heydoGreen,
          ),
        ),
        const SizedBox(height: 36),
        Text(s.chooseLanguage, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 24),
        BigButton(
          label: s.malayalam,
          icon: Icons.translate,
          onPressed: () {
            context.read<AppState>().setLang(Lang.ml);
            _go(context, const PhoneScreen());
          },
        ),
        const SizedBox(height: 14),
        BigButton(
          label: s.english,
          icon: Icons.translate,
          filled: false,
          onPressed: () {
            context.read<AppState>().setLang(Lang.en);
            _go(context, const PhoneScreen());
          },
        ),
      ],
    );
  }
}

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});
  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.enterPhone,
      actions: const [LanguageToggle()],
      children: [
        const SizedBox(height: 20),
        TextField(
          controller: _ctrl,
          keyboardType: TextInputType.phone,
          style: const TextStyle(fontSize: 20),
          decoration: InputDecoration(
            prefixText: '+91 ',
            hintText: s.phoneHint,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 24),
        BigButton(
          label: s.sendOtp,
          icon: Icons.sms,
          busy: app.busy,
          onPressed: () async {
            final phone = '+91${_ctrl.text.trim()}';
            if (await context.read<AppState>().requestOtp(phone) && context.mounted) {
              _go(context, const OtpScreen());
            }
          },
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.enterOtp,
      actions: const [LanguageToggle()],
      children: [
        const SizedBox(height: 12),
        Text('${s.otpSentTo} ${app.phone}', style: const TextStyle(fontSize: 15)),
        // Dev convenience only (mock SMS). Never shown in production.
        if (app.devCode != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('demo code: ${app.devCode}',
                style: const TextStyle(fontSize: 13, color: Colors.orange)),
          ),
        const SizedBox(height: 20),
        TextField(
          controller: _ctrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          style: const TextStyle(fontSize: 24, letterSpacing: 8),
          textAlign: TextAlign.center,
          decoration: const InputDecoration(
            counterText: '',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        BigButton(
          label: s.verify,
          icon: Icons.verified_user,
          busy: app.busy,
          onPressed: () async {
            if (await context.read<AppState>().verifyOtp(_ctrl.text.trim()) &&
                context.mounted) {
              _go(context, const RoleScreen());
            }
          },
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class RoleScreen extends StatefulWidget {
  const RoleScreen({super.key});
  @override
  State<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends State<RoleScreen> {
  final _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.chooseRole,
      children: [
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          style: const TextStyle(fontSize: 20),
          decoration: InputDecoration(labelText: s.yourName, border: const OutlineInputBorder()),
        ),
        const SizedBox(height: 24),
        BigButton(
          label: s.iAmWorker,
          icon: Icons.handyman,
          busy: app.busy,
          onPressed: () async {
            final name = _name.text.trim().isEmpty ? 'Worker' : _name.text.trim();
            if (await context.read<AppState>().selectWorker(name) && context.mounted) {
              _go(context, const VkycScreen());
            }
          },
        ),
        const SizedBox(height: 14),
        // Giver path is lighter (no VKYC) — wired fully in later phases.
        BigButton(
          label: s.iAmGiver,
          icon: Icons.home_repair_service,
          filled: false,
          busy: app.busy,
          onPressed: () async {
            final name = _name.text.trim().isEmpty ? 'Giver' : _name.text.trim();
            if (await context.read<AppState>().selectGiver(name) && context.mounted) {
              _go(context, const VkycScreen());
            }
          },
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class VkycScreen extends StatefulWidget {
  const VkycScreen({super.key});
  @override
  State<VkycScreen> createState() => _VkycScreenState();
}

class _VkycScreenState extends State<VkycScreen> {
  bool _consented = false;
  bool _started = false;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.verifyIdentity,
      children: [
        const SizedBox(height: 12),
        const Icon(Icons.video_camera_front, size: 64, color: HeydoColors.heydoGreen),
        const SizedBox(height: 16),
        Text(
          app.role == 'giver' ? s.giverVkycExplainer : s.vkycExplainer,
          style: const TextStyle(fontSize: 16, height: 1.4),
        ),
        const SizedBox(height: 16),
        CheckboxListTile(
          value: _consented,
          onChanged: (v) => setState(() => _consented = v ?? false),
          title: Text(s.consentLine, style: const TextStyle(fontSize: 15)),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        const SizedBox(height: 8),
        if (!_started)
          BigButton(
            label: s.startVkyc,
            icon: Icons.play_circle_fill,
            busy: app.busy,
            onPressed: _consented
                ? () async {
                    if (await context.read<AppState>().consentAndStartVkyc()) {
                      setState(() => _started = true);
                    }
                  }
                : null,
          )
        else
          BigButton(
            label: s.simulateResult,
            icon: Icons.check_circle,
            busy: app.busy,
            onPressed: () async {
              if (await context.read<AppState>().completeVkycDemo() && context.mounted) {
                _go(context, const StatusScreen());
              }
            },
          ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final (label, color, icon, msg) = switch (app.verificationStatus) {
      'approved' => (
          s.statusApproved,
          HeydoColors.trustGreen,
          Icons.verified,
          app.role == 'giver' ? s.giverApprovedMsg : s.approvedMsg
        ),
      'pending' => (s.statusPending, Colors.orange, Icons.hourglass_top, s.pendingMsg),
      'rejected' => (s.statusRejected, Colors.red, Icons.cancel, s.somethingWrong),
      _ => (s.statusUnverified, Colors.grey, Icons.person_outline, ''),
    };
    return HeydoScaffold(
      title: s.appName,
      children: [
        const SizedBox(height: 28),
        Icon(icon, size: 80, color: color),
        const SizedBox(height: 16),
        Center(
            child: Text(label,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: color))),
        const SizedBox(height: 16),
        Text(msg, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, height: 1.4)),
        const SizedBox(height: 24),
        if (app.canApply)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: HeydoColors.mintSurface, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.work, color: HeydoColors.heydoGreen),
              const SizedBox(width: 10),
              Expanded(
                  child: Text(s.canApplyYes,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
            ]),
          ),
        if (app.canPost)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: HeydoColors.mintSurface, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.home_repair_service, color: HeydoColors.heydoGreen),
              const SizedBox(width: 10),
              Expanded(
                  child: Text(s.canPostYes,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
            ]),
          ),
        const Spacer(),
        BigButton(
          label: app.s.next,
          icon: Icons.refresh,
          filled: false,
          busy: app.busy,
          onPressed: () => context.read<AppState>().refreshStatus(),
        ),
      ],
    );
  }
}

// Helpers
void _go(BuildContext context, Widget screen) {
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
}

Widget _error(String msg) => Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Text(msg, style: const TextStyle(color: Colors.red, fontSize: 14)),
    );
