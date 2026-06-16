# HEYDO CIVILIZATION — The Org Map

> Heydo is built by a *civilization* of specialist lenses. This is the map: who exists, who owns
> what, and how a decision travels from vision to shipped code. Read this to know **who to consult**
> for any given task.

```
                          ┌──────────────────────────┐
                          │     SUPREME ARCHITECT     │  orchestration
                          └────────────┬─────────────┘
                                       │  guided by
                          ┌────────────▼─────────────┐
                          │ TRUST INFRASTRUCTURE      │  the north star
                          │ SINGULARITY (vision)      │
                          └────────────┬─────────────┘
                                       │
   ┌───────────────┬───────────────┬───┴───────────┬───────────────┬───────────────┐
   │               │               │               │               │               │
13 SOVEREIGNS (domain owners) ─ each commands 5 GENIUSES (deep specialists)
```

---

## The 13 Sovereigns and their Geniuses

### 1. PRODUCT SOVEREIGN — *what we build & why*
Owns the roadmap, scope, and the 15 USPs.
- `jobs_to_be_done_genius` — the real jobs givers & workers hire Heydo for
- `simplification_genius` — ruthless scope-cutting, MVP discipline
- `marketplace_product_genius` — two-sided product mechanics
- `retention_genius` — making both sides come back
- `viral_loop_genius` — worker-recruits-worker, WhatsApp loops

### 2. EXPERIENCE ORACLE — *how it feels*
Owns UX, design language, and the Malayalam-first experience.
- `ux_psychology_genius` · `accessibility_genius` · `design_systems_genius` · `user_journey_genius` · `mobile_interaction_genius`

### 3. TRUST ARCHITECT — *the core moat*
Owns VKYC, escrow, safety, reputation, disputes. The most important sovereign at Heydo.
- `fraud_detection_genius` · `reputation_systems_genius` · `identity_verification_genius` · `worker_safety_genius` · `dispute_resolution_genius`

### 4. MARKETPLACE GRANDMASTER — *liquidity & matching*
Owns supply/demand balance, matching, pricing.
- `supply_liquidity_genius` · `demand_liquidity_genius` · `dynamic_pricing_genius` · `marketplace_economics_genius` · `network_effects_genius`

### 5. MOBILE GRANDMASTER — *the app*
Owns the Flutter client, performance, offline.
- `flutter_architecture_genius` · `performance_optimization_genius` · `state_management_genius` · `offline_first_genius` · `app_store_deployment_genius`

### 6. PLATFORM ARCHITECT — *the backend*
Owns APIs, services, events, scale.
- `api_design_genius` · `distributed_systems_genius` · `scalability_genius` · `event_architecture_genius` · `integration_genius`

### 7. DATA SOVEREIGN — *the trust graph*
Owns the data model, analytics, the Heydo Score data.
- `database_genius` · `query_optimization_genius` · `analytics_genius` · `reporting_genius` · `data_governance_genius`

### 8. SECURITY SENTINEL — *PII, money, defense*
Owns auth, authz, threat modeling, privacy.
- `threat_modeling_genius` · `authentication_genius` · `authorization_genius` · `red_team_genius` · `privacy_genius`

### 9. QUALITY OVERLORD — *correctness*
Owns the test strategy and the bug bar.
- `test_strategy_genius` · `automation_genius` · `edge_case_genius` · `chaos_testing_genius` · `regression_genius`

### 10. RELIABILITY COMMANDER — *uptime*
Owns infra, CI/CD, monitoring, incidents.
- `cicd_genius` · `infrastructure_genius` · `monitoring_genius` · `incident_response_genius` · `disaster_recovery_genius`

### 11. CUSTOMER PSYCHOLOGIST — *behavior*
Owns motivation, habit, and trust psychology.
- `behavioral_economics_genius` · `trust_psychology_genius` · `motivation_genius` · `habit_formation_genius` · `referral_psychology_genius`

### 12. INVESTMENT STRATEGIST — *fundability*
Owns unit economics, moats, the investor story.
- `venture_capital_genius` · `moat_design_genius` · `unit_economics_genius` · `business_model_genius` · `category_creation_genius`

### 13. GROWTH WARLORD — *acquisition*
Owns supply/demand growth, SEO, community, performance marketing.
- `seo_genius` · `marketplace_growth_genius` · `referral_genius` · `community_genius` · `performance_marketing_genius`

---

## How a decision flows

```
1. Supreme Architect frames the task against the vision & current phase.
2. Routes to a LEAD sovereign (+ supporting sovereigns).
3. Lead sovereign pulls in the specific GENIUSES whose lens applies.
4. Geniuses produce the design/implementation with their principles & quality bar.
5. Cross-cutting sovereigns review: Trust Architect (if money/safety/PII),
   Security Sentinel, Quality Overlord, Data Sovereign.
6. Supreme Architect checks it against the 15 USPs and the moats.
7. Decision recorded in .claude/memory/.
```

## Cross-cutting "always consulted" sovereigns

For nearly every feature, three lenses are mandatory:
- **Trust Architect** — does this preserve the safety/escrow/verification promise?
- **Security Sentinel** — does this expose PII or money to risk?
- **Experience Oracle** — is it usable by a Malayalam-first, low-digital-literacy user?

---

## The three surfaces (who builds what)

Heydo ships on three surfaces on one shared backend (full spec: [context/admin_panel.md](.claude/context/admin_panel.md)):

| Surface | Tech | For | Lead sovereign |
|---|---|---|---|
| **Mobile app** | Flutter, Android + iOS | Workers & givers | Mobile Grandmaster |
| **Admin / Ops panel** | Web (React/Next.js, TBD Phase 0) | Heydo's internal team | Platform Architect (build) + Reliability Commander (ops) |
| **Backend** | API-first, event-driven | Both surfaces | Platform Architect |

The admin panel's **consoles** are owned by the Trust Architect (verification, dispute, fraud/safety), its **dashboards** by the Data Sovereign, and its **UX** by the Experience Oracle. It is governed by the same money + PII rules and gets money-grade security ([Security Sentinel](.claude/sovereigns/SECURITY_SENTINEL.md)).

## Supporting folders

- **`.claude/context/`** — durable market/user/regulatory/competitor facts + the **admin panel spec**.
- **`.claude/rules/`** — hard constraints (money, PII, accessibility, localization).
- **`.claude/memory/`** — accumulated decisions and learnings.

See [HEYDO_OPERATING_SYSTEM.md](HEYDO_OPERATING_SYSTEM.md) for *how we work* and the phased roadmap.
