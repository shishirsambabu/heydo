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
        if (app.canApply) ...[
          const SizedBox(height: 16),
          BigButton(
            label: s.browseSafeGigs,
            icon: Icons.work,
            busy: app.busy,
            onPressed: () async {
              if (await context.read<AppState>().loadVisibleGigs() && context.mounted) {
                _go(context, const WorkerGigListScreen());
              }
            },
          ),
        ],
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
        if (app.canPost) ...[
          const SizedBox(height: 16),
          BigButton(
            label: s.postSafeGig,
            icon: Icons.add_business,
            busy: app.busy,
            onPressed: () async {
              if (await context.read<AppState>().loadMarketplaceSetup() && context.mounted) {
                _go(context, const PostGigScreen());
              }
            },
          ),
          const SizedBox(height: 10),
          BigButton(
            label: s.manageMyGigs,
            icon: Icons.assignment,
            filled: false,
            busy: app.busy,
            onPressed: () async {
              if (await context.read<AppState>().loadMyGigs() && context.mounted) {
                _go(context, const GiverGigListScreen());
              }
            },
          ),
        ],
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

class WorkerGigListScreen extends StatelessWidget {
  const WorkerGigListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final gigs = app.visibleGigs;

    return HeydoScaffold(
      title: s.browseSafeGigs,
      children: [
        Expanded(
          child: gigs.isEmpty
              ? Center(child: Text(s.noGigs, style: const TextStyle(fontSize: 16)))
              : ListView.separated(
                  itemCount: gigs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final gig = gigs[index];
                    return _GigCard(gig: gig);
                  },
                ),
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class GiverGigListScreen extends StatelessWidget {
  const GiverGigListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final gigs = app.myGigs;

    return HeydoScaffold(
      title: s.manageMyGigs,
      children: [
        Expanded(
          child: gigs.isEmpty
              ? Center(child: Text(s.noMyGigs, style: const TextStyle(fontSize: 16)))
              : ListView.separated(
                  itemCount: gigs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final gig = gigs[index];
                    return _GiverGigCard(gig: gig);
                  },
                ),
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class _GiverGigCard extends StatelessWidget {
  const _GiverGigCard({required this.gig});

  final Map<String, dynamic> gig;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final title = (gig['title'] ?? '') as String;
    final location = (gig['location'] ?? '') as String;
    final budget = gig['budgetAmount'];
    final visibility = (gig['visibilityStatus'] ?? '') as String;
    final status = (gig['status'] ?? '') as String;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: HeydoColors.mintSurface),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('$location · ₹$budget', style: const TextStyle(fontSize: 14, color: Colors.black54)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusPill(label: visibility),
              _StatusPill(label: status),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: app.busy
                ? null
                : () async {
                    final gigId = gig['id'] as String;
                    if (await context.read<AppState>().loadApplications(gigId) && context.mounted) {
                      _go(context, ApplicantListScreen(gig: gig));
                    }
                  },
            icon: const Icon(Icons.people),
            label: Text(s.viewApplicants),
          ),
        ],
      ),
    );
  }
}

class ApplicantListScreen extends StatelessWidget {
  const ApplicantListScreen({super.key, required this.gig});

  final Map<String, dynamic> gig;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final applications = app.currentApplications;

    return HeydoScaffold(
      title: s.applicants,
      children: [
        Text(
          gig['title'] as String? ?? '',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: applications.isEmpty
              ? Center(child: Text(s.noApplicants, style: const TextStyle(fontSize: 16)))
              : ListView.separated(
                  itemCount: applications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final application = applications[index];
                    return _ApplicantCard(gig: gig, application: application);
                  },
                ),
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class _ApplicantCard extends StatelessWidget {
  const _ApplicantCard({required this.gig, required this.application});

  final Map<String, dynamic> gig;
  final Map<String, dynamic> application;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final workerId = (application['workerId'] ?? '') as String;
    final message = (application['messageMl'] ?? '') as String;
    final proposedPrice = application['proposedPrice'] ?? gig['budgetAmount'];
    final status = (application['status'] ?? '') as String;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: HeydoColors.mintSurface),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(workerId, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('${s.agreedAmount}: ₹$proposedPrice',
              style: const TextStyle(fontSize: 14, color: Colors.black54)),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(fontSize: 14, height: 1.35)),
          ],
          const SizedBox(height: 10),
          _StatusPill(label: status),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: app.busy || status != 'applied'
                ? null
                : () async {
                    final ok = await context.read<AppState>().selectApplication(
                          gigId: gig['id'] as String,
                          applicationId: application['id'] as String,
                        );
                    if (ok && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(s.workerSelected)),
                      );
                    }
                  },
            icon: const Icon(Icons.check_circle),
            label: Text(s.selectWorker),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: HeydoColors.mintSurface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

class _GigCard extends StatelessWidget {
  const _GigCard({required this.gig});

  final Map<String, dynamic> gig;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>().s;
    final title = (gig['title'] ?? '') as String;
    final description = (gig['description'] ?? '') as String;
    final location = (gig['location'] ?? '') as String;
    final budget = gig['budgetAmount'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: HeydoColors.mintSurface),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('$location · ₹$budget', style: const TextStyle(fontSize: 14, color: Colors.black54)),
          const SizedBox(height: 8),
          Text(description, style: const TextStyle(fontSize: 14, height: 1.35)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _go(context, ApplyGigScreen(gig: gig)),
            icon: const Icon(Icons.send),
            label: Text(s.apply),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _go(context, SafetyReportScreen(gig: gig)),
            icon: const Icon(Icons.report),
            label: Text(s.reportUnsafe),
          ),
        ],
      ),
    );
  }
}

class ApplyGigScreen extends StatefulWidget {
  const ApplyGigScreen({super.key, required this.gig});

  final Map<String, dynamic> gig;

  @override
  State<ApplyGigScreen> createState() => _ApplyGigScreenState();
}

class _ApplyGigScreenState extends State<ApplyGigScreen> {
  final _message = TextEditingController();
  final _price = TextEditingController();

  @override
  void dispose() {
    _message.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.apply,
      children: [
        Text(widget.gig['title'] as String? ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        _field(_message, s.applicationMessage, maxLines: 3),
        const SizedBox(height: 12),
        _field(_price, s.proposedPrice, keyboardType: TextInputType.number),
        const SizedBox(height: 8),
        Text(s.fairCounteroffer, style: const TextStyle(fontSize: 13, color: Colors.black54)),
        const SizedBox(height: 18),
        BigButton(
          label: s.apply,
          icon: Icons.send,
          busy: app.busy,
          onPressed: () async {
            final price = int.tryParse(_price.text.trim());
            final ok = await context.read<AppState>().applyToGig(
                  gigId: widget.gig['id'] as String,
                  messageMl: _message.text.trim(),
                  proposedPrice: price,
                );
            if (ok && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.applicationSent)));
            }
          },
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

class SafetyReportScreen extends StatefulWidget {
  const SafetyReportScreen({super.key, required this.gig});

  final Map<String, dynamic> gig;

  @override
  State<SafetyReportScreen> createState() => _SafetyReportScreenState();
}

class _SafetyReportScreenState extends State<SafetyReportScreen> {
  final _details = TextEditingController();
  String _reason = 'unsafe_location';

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    return HeydoScaffold(
      title: s.reportUnsafe,
      children: [
        DropdownButtonFormField<String>(
          value: _reason,
          decoration: InputDecoration(labelText: s.reportReason, border: const OutlineInputBorder()),
          items: [
            DropdownMenuItem(value: 'unsafe_location', child: Text(s.unsafeLocation)),
            DropdownMenuItem(value: 'harassment', child: Text(s.harassment)),
            DropdownMenuItem(value: 'off_platform_payment', child: Text(s.offPlatformPayment)),
            DropdownMenuItem(value: 'sexual_misconduct', child: Text(s.sexualMisconduct)),
            DropdownMenuItem(value: 'drugs_or_illegal_activity', child: Text(s.illegalActivity)),
            DropdownMenuItem(value: 'violence_or_threat', child: Text(s.violenceThreat)),
            DropdownMenuItem(value: 'fraud', child: Text(s.fraud)),
            DropdownMenuItem(value: 'other', child: Text(s.other)),
          ],
          onChanged: (value) => setState(() => _reason = value ?? _reason),
        ),
        const SizedBox(height: 12),
        _field(_details, s.reportDetails, maxLines: 4),
        const SizedBox(height: 18),
        BigButton(
          label: s.reportUnsafe,
          icon: Icons.report,
          filled: false,
          busy: app.busy,
          onPressed: () async {
            if (_details.text.trim().length < 10) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.fillAllFields)));
              return;
            }
            final ok = await context.read<AppState>().raiseSafetyReport(
                  gigId: widget.gig['id'] as String,
                  reason: _reason,
                  severity: _highRiskReasons.contains(_reason) ? 'high' : 'medium',
                  description: _details.text.trim(),
                );
            if (ok && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.reportSent)));
            }
          },
        ),
        if (app.error != null) _error(app.error!),
      ],
    );
  }
}

const _highRiskReasons = {
  'sexual_misconduct',
  'drugs_or_illegal_activity',
  'violence_or_threat',
};

class PostGigScreen extends StatefulWidget {
  const PostGigScreen({super.key});

  @override
  State<PostGigScreen> createState() => _PostGigScreenState();
}

class _PostGigScreenState extends State<PostGigScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _location = TextEditingController();
  final _budget = TextEditingController();
  String? _categoryId;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _location.dispose();
    _budget.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final s = app.s;
    final categories = app.categories;
    _categoryId ??= categories.isNotEmpty ? categories.first['id'] as String? : null;
    final guide = _categoryId == null ? null : app.pricingGuideFor(_categoryId!);

    return HeydoScaffold(
      title: s.postSafeGig,
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  value: _categoryId,
                  decoration: InputDecoration(labelText: s.category, border: const OutlineInputBorder()),
                  items: categories
                      .map((category) => DropdownMenuItem<String>(
                            value: category['id'] as String,
                            child: Text((category['nameMl'] ?? category['nameEn']) as String),
                          ))
                      .toList(),
                  onChanged: (value) => setState(() => _categoryId = value),
                ),
                const SizedBox(height: 12),
                _field(_title, s.gigTitle),
                const SizedBox(height: 12),
                _field(_description, s.gigDescription, maxLines: 3),
                const SizedBox(height: 12),
                _field(_location, s.gigLocation),
                const SizedBox(height: 12),
                _field(_budget, s.budgetInr, keyboardType: TextInputType.number),
                if (guide != null) ...[
                  const SizedBox(height: 12),
                  _GuideBox(guide: guide, label: s.fairPriceGuide),
                ],
                const SizedBox(height: 18),
                BigButton(
                  label: s.submitGig,
                  icon: Icons.shield,
                  busy: app.busy,
                  onPressed: () async {
                    final budget = int.tryParse(_budget.text.trim());
                    if (_categoryId == null ||
                        _title.text.trim().isEmpty ||
                        _description.text.trim().isEmpty ||
                        _location.text.trim().isEmpty ||
                        budget == null) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.fillAllFields)));
                      return;
                    }
                    final posted = await context.read<AppState>().postGig(
                          categoryId: _categoryId!,
                          title: _title.text.trim(),
                          description: _description.text.trim(),
                          location: _location.text.trim(),
                          budgetAmount: budget,
                        );
                    if (!posted || !context.mounted) return;
                    final gig = context.read<AppState>().lastPostedGig;
                    final status = gig?['visibilityStatus'] as String?;
                    final message = switch (status) {
                      'visible' => s.gigVisible,
                      'rejected' => s.gigRejected,
                      _ => s.gigUnderReview,
                    };
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
                  },
                ),
                if (app.error != null) _error(app.error!),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

Widget _field(
  TextEditingController controller,
  String label, {
  int maxLines = 1,
  TextInputType? keyboardType,
}) =>
    TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
    );

class _GuideBox extends StatelessWidget {
  const _GuideBox({required this.guide, required this.label});

  final Map<String, dynamic> guide;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: HeydoColors.mintSurface, borderRadius: BorderRadius.circular(12)),
      child: Text(
        '$label: ₹${guide['minBudgetAmount']} - ₹${guide['highReviewAmount']} · ${guide['notes']}',
        style: const TextStyle(fontSize: 14, height: 1.35),
      ),
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
