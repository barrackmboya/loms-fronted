**LENDING RISK ARCHITECTURE**

**Loan Origination & Management System**

Comprehensive Schema

KYC / Onboarding · Fraud & Document Verification · Credit Scoring &
Limits

Risk-Based Pricing · IFRS 9 Provisioning · Portfolio Monitoring ·
Collections & EWS

Plus system architecture for engineering and operations (services,
events, data plane, security)

Version 1.0 \| September 2026 \| Reference architecture for design, data
model, and metric catalog

*Not a regulatory opinion. Adapt PD/LGD/EAD definitions, default
definitions, and SICR policy to local supervisor and product book.*

# 1. Purpose and design principles

This schema describes an end-to-end credit system in which no loan is
originated, priced, booked, or collected without a measurable risk
object attached to it. Each module produces scores, gates, and metrics
that the next module consumes. The unit of work is the Application
through to the Account and, after default, the Collection Case.

Five design principles:

- Gate before score. Identity, fraud, and document integrity must pass
  (or be explicitly overridden with audit) before credit models consume
  the file.

- One customer, many scores. Application score, bureau score,
  affordability score, fraud score, IFRS 9 PD, early-warning score, and
  collection propensity are separate objects with versioned models.

- Point-in-time and through-the-cycle live together. Origination and
  IFRS 9 use PIT, forward-looking parameters. Capital and pricing floors
  may use TTC overlays.

- Explainability is a first-class field. Every automated decision stores
  reason codes, feature contributions, policy rule hits, and model
  version.

- Monitoring is continuous, not a report. Portfolio and EWS scores
  refresh on a defined cadence (daily for performing book; intra-day for
  high-risk and collections).

# 2. End-to-end process and decision gates

## 2.1 Lifecycle

Lead / Pre-qualify → Application capture → KYC & identity → Document
ingest & forensics → Fraud fusion → Affordability & bureau → Application
credit score & limit → Risk-based price & product offer → Underwriter /
STP decision → Contract & disbursement → Booking (Stage 1 ECL) →
Performing monitoring & EWS → SICR / Stage migration → Delinquency →
Collection propensity & strategy → Cure, restructure, write-off, or
recover.

## 2.2 Hard gates (must resolve before next stage)

| **Gate**              | **Pass condition**                                                              | **Fail / exception path**                  |
|-----------------------|---------------------------------------------------------------------------------|--------------------------------------------|
| G1 Identity           | KYC status = VERIFIED; sanctions/PEP/adverse media clear or approved            | Reject or enhanced due diligence queue     |
| G2 Document integrity | Required pack complete; forensic score below reject threshold                   | Re-request docs or fraud investigation     |
| G3 Fraud fusion       | Composite fraud score \< cutoff; no confirmed synthetic / first-party fraud     | Decline or SIU referral                    |
| G4 Policy knockout    | No hard policy fails (age, jurisdiction, prohibited sector, existing NPL, etc.) | Auto-decline                               |
| G5 Affordability      | DSR / FOIR / DSCR within policy after verified income                           | Reduce limit or decline                    |
| G6 Credit decision    | Application score + overrides produce APPROVE / CONDITIONAL                     | Decline; retain score for decline analysis |
| G7 Price & limit      | Priced offer within risk-appetite bands; limit ≤ capacity                       | Re-price, downsell, or decline             |
| G8 Disburse           | Mandate, collateral, insurance, conditions precedent complete                   | Hold booking                               |
| G9 Stage 1 book       | IFRS 9 PD/LGD/EAD assigned; 12-month ECL posted                                 | Do not book until ECL engine returns       |

# 3. Logical data model (core entities)

Treat these as canonical objects. Physical tables can split history,
scores, and documents. Every score row is append-only with
model_version, as_of_ts, and feature_snapshot_id.

## 3.1 Party and identity

| **Entity**              | **Key fields**                                                          | **Notes**                                                |
|-------------------------|-------------------------------------------------------------------------|----------------------------------------------------------|
| PARTY                   | party_id, party_type (IND/ORG), status, created_ts                      | Golden customer record                                   |
| PARTY_IDENTITY          | id_type, id_number_hash, issuing_country, expiry, verify_status, source | Never store raw national ID in clear in analytics stores |
| PARTY_BIOMETRIC         | face_match_score, liveness_score, capture_ts, vendor                    | vKYC evidence                                            |
| PARTY_ADDRESS / CONTACT | type, value, verified_flag, geo, source                                 | Velocity and device linkage use these                    |
| RELATED_PARTY           | from_id, to_id, relation_type, ownership_pct                            | UBO, employer, guarantor, household                      |
| SANCTIONS_SCREEN        | list, match_score, disposition, analyst_id, as_of                       | PEP, AML, adverse media                                  |

## 3.2 Application, documents, fraud

| **Entity**      | **Key fields**                                                                   | **Notes**                            |
|-----------------|----------------------------------------------------------------------------------|--------------------------------------|
| APPLICATION     | app_id, party_id, product_id, channel, amount_requested, tenure, purpose, status | Status machine is explicit           |
| APP_DECLARATION | income, employment, expenses, dependents, existing_debt                          | Stated vs verified stored separately |
| DOCUMENT        | doc_id, app_id, doc_type, hash, mime, source (upload/AA/DigiLocker)              | Immutable blob + metadata            |
| DOC_FORENSIC    | tamper_score, metadata_anomaly, template_match, vendor_score                     | One row per check run                |
| FRAUD_SIGNAL    | signal_code, severity, value, source                                             | Device, velocity, graph, synthetic   |
| FRAUD_SCORE     | composite, first_party, third_party, synthetic, decision                         | Fusion layer output                  |

## 3.3 Credit decision, account, collateral

| **Entity**         | **Key fields**                                                   | **Notes**                     |
|--------------------|------------------------------------------------------------------|-------------------------------|
| BUREAU_PULL        | bureau, pull_type (soft/hard), score, tradelines_json, enquiries | Retain raw + parsed           |
| CREDIT_SCORE       | score_type, raw_score, pd_12m, grade, reason_codes\[\], model_id | APP, BEHAVIOURAL, BUREAU      |
| AFFORDABILITY      | verified_income, commitments, DSR, FOIR, residual, method        | Stated vs verified dual track |
| LIMIT_DECISION     | approved_limit, tenor, product, conditions\[\], decision         | May downsell                  |
| PRICING            | risk_band, base_rate, risk_premium, all-in rate, fees, APR/EIR   | Risk-based + commercial caps  |
| ACCOUNT            | account_id, app_id, party_id, booked_ts, principal, EIR, status  | Servicing system of record    |
| SCHEDULE / PAYMENT | due_dt, due_amt, paid_amt, dpd, channel                          | Source of DPD and bounce      |
| COLLATERAL         | type, valuation, ltv, haircut, last_reval_dt, enforceability     | Feeds LGD                     |
| GUARANTEE          | guarantor_id, type, amount, rating                               | CRM / LGD credit              |

## 3.4 IFRS 9, monitoring, collections

| **Entity**      | **Key fields**                                              | **Notes**                      |
|-----------------|-------------------------------------------------------------|--------------------------------|
| IFRS9_POSITION  | account_id, as_of, stage, sicr_flag, default_flag           | Daily or month-end snapshot    |
| ECL_RUN         | run_id, scenario, weight, pd, lgd, ead, ecl, discounted_ecl | Multi-scenario weighted        |
| MACRO_SCENARIO  | name, weight, horizon, variable set                         | Baseline / upside / downside   |
| EWS_SCORE       | score, band (G/A/R), drivers\[\], recommended_action        | Pre-delinquency                |
| COLLECTION_CASE | case_id, account_id, entry_dpd, strategy, owner             | Opens at policy DPD or EWS red |
| COLLECT_SCORE   | horizon, p_roll, p_cure, p_pay_today, expected_recovery     | Pre and post variants          |
| TREATMENT       | channel, offer_type, cost, outcome, promise_dt              | For strategy optimization      |
| MODEL_REGISTRY  | model_id, type, version, train_dt, champion/challenger, auc | Governance                     |

# 4. Module A — KYC, onboarding, fraud, document verification

## 4.1 Objectives

Prove the person or entity is who they claim to be, is allowed to be
served, submitted authentic evidence, and is not a synthetic, mule, or
first-party fraud pattern. Output is a KYC case status plus a fraud
composite that either blocks or annotates the credit file.

## 4.2 Process blocks

- Identity: government ID validation, biometric face match, liveness,
  video KYC where required, UBO and corporate registry for SMEs.

- Screening: sanctions, PEP, adverse media, internal watchlist,
  related-party graph.

- Document pack: required vs optional by product; completeness; expiry;
  source-of-truth preference (account aggregator / employer API over
  uploaded PDF).

- Forensics: file metadata, edit traces, template mismatch, reused
  images, inconsistent fonts/dates, EXIF vs claimed origin.

- Fraud fusion: device fingerprint, IP/geo vs KYC address, application
  velocity, graph (shared device/phone/employer), synthetic identity
  features, income/document inconsistency.

- AML/KYC refresh: periodic and event-driven re-KYC after booking (not
  only at origination).

## 4.3 Metric catalog — KYC / onboarding

| **Metric**                     | **Definition**                            | **Why it matters**                  |
|--------------------------------|-------------------------------------------|-------------------------------------|
| KYC completion rate            | Verified KYC / applications started       | Funnel leakage vs control tightness |
| STP KYC rate                   | Auto-verified with no analyst / total KYC | Cost and cycle time                 |
| KYC cycle time (p50/p95)       | Minutes from start to VERIFIED or FAIL    | Drop-off driver                     |
| ID match rate                  | Successful bureau/gov ID match            | Data quality + fraud                |
| Face-match score distribution  | Histogram of biometric scores             | Threshold calibration               |
| Liveness fail rate             | Failed liveness / vKYC attempts           | Presentation-attack pressure        |
| EDD rate                       | Enhanced due diligence / KYC cases        | Risk mix of book                    |
| Sanctions true-match rate      | Confirmed hits / alerts                   | Alert quality                       |
| False positive screen rate     | Cleared alerts / alerts                   | Ops load                            |
| Re-KYC overdue %               | Parties past refresh SLA                  | Compliance residual risk            |
| Beneficial owner completeness  | Orgs with UBO chain complete              | AML quality                         |
| Onboarding abandonment by step | Drop-off at ID, docs, funding             | UX vs friction trade-off            |

## 4.4 Metric catalog — document verification

| **Metric**                       | **Definition**                            | **Why it matters**                     |
|----------------------------------|-------------------------------------------|----------------------------------------|
| Pack completeness rate           | Apps with all required docs accepted      | Prevents underwriting on partial files |
| First-time-right doc rate        | Accepted on first upload / uploads        | Customer friction                      |
| Forensic flag rate               | Docs with tamper/anomaly above warn       | Attack surface                         |
| Confirmed doc fraud rate         | SIU-confirmed / flagged                   | Model precision                        |
| Source mix                       | % AA / employer API / upload / DigiLocker | Verification quality of book           |
| OCR field error rate             | Manual corrections / extracted fields     | Data quality into score                |
| Statement months coverage        | Avg months of bank data used              | Income model robustness                |
| Doc-to-declaration mismatch rate | Income/ID fields disagree with stated     | First-party fraud + error              |

## 4.5 Metric catalog — fraud

| **Metric**                                    | **Definition**                                             | **Why it matters**          |
|-----------------------------------------------|------------------------------------------------------------|-----------------------------|
| Composite fraud score                         | Fused 0–1000 or PD-like                                    | Gate G3                     |
| Synthetic ID score                            | Inconsistency of ID, credit file thinness, date collisions | High-loss fraud type        |
| Velocity: apps per device/phone/ID 24h/7d/30d | Count + unique products                                    | Burst attacks               |
| Graph cluster risk                            | Shared attributes with known fraud                         | Network fraud               |
| Device reputation / emulator flag             | Vendor + internal                                          | Bot and farm                |
| First-party fraud rate (vintage)              | Confirmed misrep / booked loans by MOB                     | Origination quality         |
| Third-party fraud rate                        | Identity takeover / booked                                 | KYC hole                    |
| Fraud loss / disbursement                     | Net fraud \$ / \$ booked                                   | Economic control            |
| Fraud model precision@cutoff                  | Confirmed / auto-declined as fraud                         | Avoid good-customer decline |
| Override rate on fraud decline                | Analyst force-through / fraud declines                     | Governance                  |
| Time-to-detect fraud (post-book)              | Days from book to SIU confirm                              | Monitoring lag              |

## 4.6 Suggested feature groups for fraud model

- Identity consistency: name/DOB/ID/phone/email/address history
  coherence.

- Digital: device ID, rooted/jailbreak, emulator, IP proxy/VPN, geo vs
  KYC, session duration.

- Application behaviour: typing cadence, copy-paste of IDs, midnight
  applications, repeated retries.

- Financial document: round-number salaries, identical PDF templates
  across unrelated apps, edited bank lines.

- Credit file: thin file + high limit request, burst of new tradelines,
  enquiry spike.

- Network: same employer string + same device across many new-to-bank
  apps.

# 5. Module B — Credit scoring, limits, risk-based pricing

## 5.1 Score objects (keep them separate)

| **Score**                     | **Predicts**                                                   | **Used for**                            |
|-------------------------------|----------------------------------------------------------------|-----------------------------------------|
| Application / origination PD  | P(default within definition window, e.g. 90+ DPD in 12 months) | Approve/decline, grade, limit, price    |
| Bureau score (external)       | Generic credit risk                                            | Knockout, overlay, dual-score policy    |
| Affordability / capacity      | P(payment stress) and max instalment                           | Limit cap, tenor                        |
| Limit model                   | Optimal exposure given PD, LGD, capital, margin                | Approved amount                         |
| Behavioural score (post-book) | Forward PD given performance                                   | Limit management, EWS, staging overlay  |
| Response / take-up score      | P(accept offer)                                                | Price elasticity, offer design          |
| Fraud-adjusted PD             | Credit PD conditioned on residual fraud risk                   | Conservative book where fraud uncertain |

## 5.2 Application scorecard — typical feature families

- Bureau: score, worst status, utilisation, enquiries 3/6/12m, age of
  file, unsecured balances, recent delinquencies.

- Affordability: verified income, residual income, DSR/FOIR, expense
  ratio, dependents, employment tenure, sector/employer stability.

- Banking behaviour (AA/statements): salary regularity, buffer vs EMI,
  NSF/bounce count, gambling/cash intensity, inflow volatility.

- Application: requested amount vs income, purpose, channel, existing
  relationship tenure, product mix.

- Collateral (secured): LTV, asset liquidity, valuation confidence,
  insurance.

- SME extras: vintage of firm, GST consistency, bank credits vs declared
  turnover, director bureau, concentration of buyers.

- Alternative (where lawful): utility/telco, psychometric only with
  strong governance, mobile money float — never as sole gate).

## 5.3 Limit engine

Approved limit is the minimum of policy max, affordability max,
collateral max, concentration caps, and risk-appetite max implied by PD
and target loss.

*Limit = min( PolicyMax, AffordabilityMax, CollateralMax(LTV),
ConcentrationHeadroom, RiskCap(PD, LGD, TargetEL, Capital) )*

RiskCap example (illustrative, not a pricing theorem): size the loan so
expected loss and capital load still clear hurdle ROE after funding and
opex. Store every binding constraint as a reason code
(AFFORDABILITY_BIND, LTV_BIND, PD_BIND).

## 5.4 Risk-based pricing

Price is a function of funding cost, operating cost, expected loss,
capital cost, and strategic margin, subject to regulatory caps and
fairness constraints.

*All-in rate ≈ Funding + Opex + EL% + CostOfCapital% + Margin ±
elasticity adjustment*

*EL% ≈ PD_horizon × LGD × EAD_factor (aligned to product life, not
necessarily IFRS 9 12m)*

Implementation notes:

- Map application grade → risk band → price grid. Do not let the neural
  net emit a rate without a band and floor/ceiling.

- Separate credit price from commercial discount. Discounts require
  authority matrix and P&L attribution.

- Verification quality can be a pricing input: AA-verified income may
  price tighter than self-uploaded statements (document as a risk
  differential, not a channel tax).

- Monitor adverse selection: take-up rate by band vs subsequent PD. If
  only high-PD customers accept a price, the grid is wrong.

- Fair lending: disparate impact tests on protected attributes even if
  those attributes are not model inputs (proxies via geography/channel).

## 5.5 Metric catalog — credit decisioning

| **Metric**                        | **Definition**                     | **Why it matters**   |
|-----------------------------------|------------------------------------|----------------------|
| Approval rate                     | Approves / decisioned apps         | Appetite vs volume   |
| STP decision rate                 | No human credit touch / decisioned | Efficiency           |
| Override rate (approve↔decline)   | Human ≠ model / decisioned         | Policy leakage       |
| Downsell rate                     | Offered \< requested / approves    | Limit engine bind    |
| Take-up rate                      | Accepted booked / approved offers  | Price & process      |
| Time-to-yes p50/p95               | App start to decision              | Conversion           |
| Average approved PD / EL          | Exposure-weighted                  | Book quality at gate |
| KS / Gini / AUC (out-of-time)     | Rank-order of defaults             | Model power          |
| PSI / CSI                         | Population & characteristic shift  | Drift                |
| Grade concentration               | % in each risk grade               | Risk appetite        |
| First-payment default / MOB3 DQ   | Early default by vintage           | Origination defect   |
| Through-the-door vs booked PD gap | Selection effect                   | Adverse selection    |
| Limit utilisation at 90 days      | Drawn / approved (revolving)       | EAD insight          |
| Price vs band slippage            | Actual APR − grid APR              | Discount leakage     |
| Hurdle ROE hit rate               | Deals clearing target ROE          | Pricing discipline   |

# 6. Module C — IFRS 9 staging and loan provisioning

## 6.1 Staging (general approach)

| **Stage** | **Credit condition**                                      | **Loss allowance**                            |
|-----------|-----------------------------------------------------------|-----------------------------------------------|
| Stage 1   | Performing; no SICR since origination                     | 12-month ECL                                  |
| Stage 2   | SICR since origination; not credit-impaired               | Lifetime ECL                                  |
| Stage 3   | Credit-impaired / defaulted (internal default definition) | Lifetime ECL; interest on net carrying amount |

Default definition must be documented (typical: 90 DPD,
unlikeliness-to-pay, specific provisions, distressed restructure). Cure
and probation rules must be explicit so accounts do not oscillate
stages.

## 6.2 Core formula

*ECL = Σ_t \[ mPD_t × LGD_t × EAD_t × Survival\_{t-1} / (1 + EIR)^t \]*

Reported ECL is the probability-weighted average across macroeconomic
scenarios (baseline, upside, downside). Stage 1 uses default events in
the next 12 months; Stages 2 and 3 use the remaining contractual life,
including expected prepayments and, for revolvers, expected drawdown via
CCF.

*Revolver EAD ≈ Drawn + CCF × Undrawn (CCF from defaulted-path history,
PIT)*

## 6.3 SICR framework (store every trigger)

- Relative PD test: lifetime PD now vs lifetime PD at origination
  exceeds a multiple and/or absolute gap (policy numbers belong in a
  governed parameter table).

- Absolute backstops: 30 DPD (IFRS 9 rebuttable presumption), watchlist,
  forbearance, rank downgrade of X notches.

- Low-credit-risk expedient: only if policy allows and instrument meets
  investment-grade equivalent.

- Collective vs individual assessment: small retail on scorecards; large
  exposures on expert + model.

- Forward-looking overlay: sector, geography, employer shock not yet in
  DPD.

## 6.4 Parameter objects

| **Parameter** | **Origination use**                                | **IFRS 9 use**                                               |
|---------------|----------------------------------------------------|--------------------------------------------------------------|
| PD            | TTC or hybrid for pricing floors; PIT for decision | PIT, forward-looking, term structure                         |
| LGD           | Downturn-leaning for price/capital                 | Best-estimate PIT; recoveries net of costs; collateral paths |
| EAD / CCF     | Limit + expected draw                              | Path to default; prepayments; undrawn                        |
| EIR           | Product APR build-up                               | Discount rate for ECL cash shortfalls                        |
| Scenarios     | Stress for appetite                                | Weighted ECL; IFRS 7 sensitivity                             |

## 6.5 Metric catalog — provisioning & credit quality

| **Metric**                  | **Definition**                                      | **Why it matters**                      |
|-----------------------------|-----------------------------------------------------|-----------------------------------------|
| Stage mix (count & \$)      | % Stage 1/2/3 of book                               | Headline credit quality                 |
| SICR rate / new Stage 2 \$  | Inflows to Stage 2 in period                        | Emerging stress                         |
| Cure rate Stage 2→1, 3→2    | With probation filter                               | Forbearance quality                     |
| Coverage ratio by stage     | ECL / gross exposure                                | Adequacy                                |
| ECL / GCA (overall)         | Stock of provisions                                 | P&L and capital                         |
| ECL charge (P&L)            | Δ stock − write-offs + recoveries (sign per policy) | Earnings volatility                     |
| Coverage vs NPL             | Stage 3 ECL / Stage 3 exposure                      | Loss given default realised vs modelled |
| PD backtest (12m)           | Predicted vs realised default by grade              | Model validity                          |
| LGD backtest                | Predicted vs closed-recovery                        | Recovery process + model                |
| EAD / CCF backtest          | Predicted vs drawn-at-default                       | Revolver risk                           |
| Overlay stock               | Management / post-model adj \$                      | Judgement vs model                      |
| Scenario weight sensitivity | ECL if downside weight +10pp                        | Disclosure & ICAAP                      |
| Write-off rate              | Write-offs / average book                           | Loss realisation                        |
| NPL / PAR30 / PAR90         | Standard portfolio DQ                               | Ops + regulator language                |

# 7. Module D — Loan and portfolio monitoring

## 7.1 Two clocks

Account clock: this borrower, this facility — payments, cash-flow,
bureau refresh, collateral, covenant, contact. Portfolio clock: vintage,
product, channel, grade, geography, officer, employer/sector —
concentration and quality drift of the factory that originated the book.

## 7.2 Account-level monitoring objects

- Repayment: DPD, days-early, partial pays, bounce/NACH fail count,
  payment channel mix.

- Behavioural score refresh (monthly or event-driven).

- Open-banking / AA refresh where consented: salary delay, buffer/EMI,
  essential vs discretionary spend, new loan credits from other lenders.

- Bureau refresh: new enquiries, new tradelines, worsening status
  elsewhere (especially useful before first missed EMI).

- Collateral: valuation lag, insurance lapse, LTV breach.

- SME: GST filings missed, covenant DSCR, auditor flags, related-party
  deposits.

- Operational: returned mail, phone disconnected, app login drop,
  complaint surge.

## 7.3 Portfolio metric catalog

| **Metric**                         | **Definition**                           | **Cut by**                     |
|------------------------------------|------------------------------------------|--------------------------------|
| Book \$ and count                  | Gross / net carrying amount              | Product, grade, stage, channel |
| Disbursement volume                | New \$ in period                         | Vintage month                  |
| PAR30 / PAR90                      | Balance ≥30/90 DPD / book                | Vintage, MOB, officer          |
| Flow rates 0–30–60–90–WO           | Roll-rate matrix                         | Product, grade                 |
| Vintage DQ curve                   | DQ% by months-on-book                    | Origination month, score band  |
| CDR / default rate                 | Defaulted principal / start principal    | Segment                        |
| CPR / prepay rate                  | Conditional prepayment                   | Rate environment, product      |
| Net credit loss                    | Write-off − recovery                     | Segment                        |
| Yield / NIM / risk-adjusted margin | Interest − EL − funding                  | Band                           |
| Concentration HHI                  | Sector, geography, employer, single name | Book                           |
| Limit breach count                 | Policy / covenant / LTV                  | Portfolio                      |
| Model PSI by vintage               | Applicant mix shift                      | Channel                        |
| Officer / branch PAR gap           | Unit PAR / book PAR                      | Agency risk                    |
| Restructure stock %                | Modified loans / book                    | Hidden stress                  |

## 7.4 Vintage and MOB are mandatory views

A blended PAR can hide a bad new vintage under an old good book. Every
credit committee pack should show MOB 1/3/6/12 default or 30 DPD by
origination month, score band, channel, and verification type (AA vs
upload). First-payment-default and MOB3 are origination defect
indicators; MOB12+ is more about economy and servicing.

# 8. Module E — Early warning and collection scores

## 8.1 Split the prediction problems

Do not use one score for everything. Pre-disbursement collection risk is
an origination overlay. Post-disbursement EWS is a performing-book
warning. In-collections scores are operational allocation tools. They
share features but have different labels, horizons, and actions.

| **Score**                          | **Population**                  | **Label (example)**                                       | **Primary action**                                    |
|------------------------------------|---------------------------------|-----------------------------------------------------------|-------------------------------------------------------|
| Pre-disburse collection propensity | Applicants passing credit gates | P(ever 30+ or 90+ in first 12 MOB); P(recover \| default) | Price, limit cut, extra collateral, decline gray zone |
| EWS / delinquency propensity       | Performing accounts (DPD 0–x)   | P(miss next EMI); P(30+ in 30–90 days)                    | RM contact, restructuring offer, limit freeze         |
| Roll-rate / severity               | Accounts already at DPD x       | P(reach x+y \| at x)                                      | Strategy intensity                                    |
| Cure propensity                    | Delinquent not charged-off      | P(return to current in 30/60d)                            | Self-cure wait vs work                                |
| Pay-today / contact propensity     | Assigned collection queue       | P(payment or kept PTP \| contact today)                   | Queue ranking                                         |
| Recovery / LGD-in-work             | Defaulted / Stage 3             | Expected \$ recovered by horizon, channel                 | Settle vs legal vs sale                               |
| Skip / contactability              | All worked accounts             | P(valid phone/address)                                    | Data enrichment spend                                 |

## 8.2 Pre-disbursement collection score

This is not a second credit PD. Credit PD answers “will they default?”.
Pre-disburse collection score answers “if this file later needs
collections, how ugly will it be, and how collectible is this person?”
Thin-file applicants with high PD but salary-domiciled accounts and
reachable contact graph may still be operationally collectible;
cash-heavy, multi-SIM, no-trace profiles are not.

Inputs beyond credit PD: contact quality (phone/email/employer
verified), stability (address tenure, job tenure), bank domicile with
lender, existing collection history on other products, collateral
enforceability, geography legal friction, household related-party
performance, device persistence.

Outputs stored on APPLICATION and copied to ACCOUNT at book:
p_ever_30_12m, p_ever_90_12m, p_right_party_contact,
expected_recovery_rate_if_default, recommended_collateral_addon,
recommended_mandate_type (auto-debit vs cash).

## 8.3 Post-disbursement EWS (before DPD)

Refresh daily. Band Green / Amber / Red with mandatory actions and SLAs.
A Red EWS account is not yet a collection case; it is a prevention case.

Leading signals that typically move 30–45 days before first miss:

- Salary credit late or missing; buffer balance falling below 1× EMI.

- Failed or cancelled auto-debit registration; repeated low-balance
  before due date.

- New unsecured enquiries or new loans elsewhere.

- Utilisation spike on revolving products; minimum-pay behaviour.

- App engagement drop; returned communications; phone invalid.

- Employer mass-layoff or sector shock list; GST stop-filings for SMEs.

- Promise patterns on other products; hardship / complaint tags.

## 8.4 In-collections scores

Once policy DPD (or Red EWS + miss) opens a case, rank work by value of
action, not by DPD alone. A DPD 45 with high pay-today score and recent
salary credit outranks a silent DPD 20.

*Work priority ≈ Expected cash from action − Cost of action − Customer
franchise penalty*

Treatments to log: SMS, USSD, app nudge, outbound call, field visit,
restructure, settlement, legal, sale. Each treatment has cost, capacity,
and empirically estimated lift. Champion-challenger the strategy tree.

## 8.5 Metric catalog — EWS and collections

| **Metric**                      | **Definition**                                     | **Why it matters**         |
|---------------------------------|----------------------------------------------------|----------------------------|
| EWS coverage                    | % performing book scored \<24h stale               | Operational readiness      |
| Alert precision                 | % Amber/Red that miss EMI in 30–60d                | Avoid cry-wolf             |
| Alert recall                    | % of future 30 DPD that were Amber/Red prior       | Early enough?              |
| Lead time                       | Median days from first Red to first miss           | Action window              |
| Contact-within-SLA              | First contact / alerts by band                     | Ops discipline             |
| Pre-delinquency cure            | Red that do not hit DPD1                           | Value of EWS               |
| Roll rate x→x+30                | By score decile                                    | Score power in collections |
| Cure rate 30/60/90              | Return to current                                  | Strategy quality           |
| PTP kept rate                   | Kept promises / promises                           | Agent + model              |
| Right-party contact rate        | RPC / attempts                                     | Data + channel             |
| Cost to collect / \$ recovered  | Direct ops cost                                    | Efficiency                 |
| Recovery curve                  | Cumulative \$ / default \$ by months-since-default | LGD calibration            |
| Legal vs soft recovery mix      | \$ and cycle time                                  | Strategy                   |
| Re-age / restructure recidivism | Re-default in 6/12m                                | Forbearance abuse          |
| NPA entry from watchlist        | Watch → NPL trend                                  | Board metric               |

# 9. Score fusion and the decision record

At origination the decision engine should persist a single
CREDIT_DECISION_RECORD:

- Inputs: KYC status, fraud composite + top signals, doc integrity,
  policy knockouts, application PD + grade, affordability max,
  collection propensity, collateral LTV.

- Outputs: decision, limit, tenor, price band, actual price, conditions
  precedent, IFRS 9 origination PD/LGD used for day-1 ECL.

- Explain: reason codes (max 5), rule hits, model versions, override
  flag + approver + justification.

- Fairness snapshot: inferred segment tests stored at portfolio level,
  not as a borrower stigma field.

Post-book, a daily ACCOUNT_RISK_SNAPSHOT stores stage, ECL, behavioural
PD, EWS band, collection scores if any, and top drivers. This snapshot
is what monitoring, finance, and collections all read so they do not
recompute competing truths.

# 10. Additional modules that improve the system

### 10.1 Model risk management

Model inventory, champion-challenger, approval committee,
development/validation/monitoring pack (AUC, KS, PSI, calibration belt,
stability of reason codes), challenger always running on 10–20% shadow.
Outcome: no silent model swap.

### 10.2 Data quality and lineage

Field-level completeness, freshness, vendor SLA, reconciliation of
servicing balances to ECL EAD. Metrics: % critical features null at
decision, bureau pull fail rate, AA consent fail rate. Bad data is a
credit risk.

### 10.3 Consent, privacy, and audit

Purpose-limited use of AA and bureau data; retention schedules;
immutable decision log; maker-checker on overrides and stage overlays.
Metrics: consent expiry, access log anomalies.

### 10.4 Collateral and valuation operations

AVM vs physical valuation variance, revaluation SLA, insurance lapse
rate, enforcement cycle time. Direct LGD lever.

### 10.5 Limit management after booking

For revolvers: behavioural re-score, limit increase/decrease, freeze on
EWS Red. Metrics: limit-increase subsequent default vs control.

### 10.6 Forbearance and hardship

Separate queue from ordinary collections. Track recidivism, Stage 2
overlays, and whether hardship is temporary (income shock) vs
structural. Prevents silent evergreening.

### 10.7 Recoveries and NPL sale

Work-in-progress inventory aged by months-since-default; bid vs hold
model using recovery curve vs sale price.

### 10.8 Capital, ICAAP, and stress

Reuse IFRS 9 engines with downturn LGD and stressed PD for ICAAP. Do not
maintain a third disconnected PD universe without a documented bridge.

### 10.9 Conduct and complaints

Collections intensity caps, vulnerable-customer flags, complaint rate by
strategy. Conduct failure becomes credit loss through remediation and
franchise damage.

### 10.10 Channel and agency quality

Broker/officer early-vintage DQ, fraud rate, override rate. Clawback
rules tied to MOB3/MOB6 defects.

# 11. Recommended operational cadences

| **Process**                     | **Cadence**                       | **Owner**                 |
|---------------------------------|-----------------------------------|---------------------------|
| KYC / fraud on new apps         | Real time                         | Onboarding + SIU          |
| Credit decision + price         | Real time / near-real-time        | Credit + pricing          |
| Day-1 ECL on booking            | At book event                     | Finance / risk ops        |
| EWS + behavioural score         | Daily                             | Credit risk / collections |
| Bureau / AA refresh (consented) | Monthly or event                  | Risk ops                  |
| IFRS 9 official run             | Month-end + intra-month flash     | Finance                   |
| SICR & watchlist committee      | Weekly                            | Credit risk               |
| Vintage & model monitoring pack | Monthly                           | MRM + credit              |
| Collections strategy review     | Weekly ops / monthly model        | Collections               |
| Model validation                | At least annual + on drift breach | Independent validation    |

# 12. Minimal policy parameters to table-drive (do not hard-code)

- Default definition, DPD backstops (30/90), cure probation days.

- SICR relative and absolute PD thresholds by product.

- Fraud and forensic cutoffs (auto-decline / review / pass).

- Affordability caps (DSR/FOIR/DSCR) by product and segment.

- Price grid by grade × product × LTV bucket; min/max APR.

- EWS thresholds and contact SLAs by band.

- Collections strategy tree: which score decile gets which treatment at
  which DPD.

- Scenario weights and overlay governance.

- Concentration caps: single name, employer, sector, geography, channel.

# 13. Implementation sequence (practical)

If building rather than replacing everything at once:

- 1\. Canonical PARTY, APPLICATION, ACCOUNT, PAYMENT, DOCUMENT — without
  these, scores have nowhere to live.

- 2\. KYC + document completeness + simple rule fraud (velocity,
  watchlist) as hard gates.

- 3\. Interpretable application scorecard + affordability + price grid.
  Log every decision.

- 4\. Servicing events → DPD, roll rates, vintage dashboards.

- 5\. IFRS 9 staging with pragmatic SICR (30 DPD + watchlist + PD
  multiple) and a documented PD/LGD/EAD v1.

- 6\. EWS on internal payment + bounce + utilisation; then add AA/bureau
  refresh.

- 7\. Collection propensity and queue ranking; treatment experiments.

- 8\. Only then deep-learning fusion, graph fraud, and highly segmented
  LGD. Complexity without labels and ops uptake is waste.

# 14. Worked numeric sketch (illustrative only)

Book a 12-month unsecured loan of 100,000 at EIR 18%. Origination PIT
12-month PD 4.0%, LGD 65%, EAD 95,000 (allowing modest prepayment before
default).

*12-month ECL ≈ 95,000 × 0.04 × 0.65 = 2,470 (then discount at EIR to
reporting date)*

If six months later lifetime PD has doubled and 30 DPD is hit, SICR
fires, account moves to Stage 2, remaining-life PD term structure is
applied, LGD may worsen if collateral-less and cure probability drops,
and ECL steps up materially. The same account’s EWS should have been
Amber/Red before the 30 DPD backstop if salary buffer and bounce signals
were live. Collections then consume p_cure and p_pay_today rather than
treating all 30 DPD as equal.

This sketch is pedagogical. Production ECL must use monthly marginal
PDs, survival, prepayment, multiple scenarios, and the institution’s
approved default definition.

# 15. Glossary of score and risk terms

| **Term**   | **Meaning in this schema**                                              |
|------------|-------------------------------------------------------------------------|
| PD         | Probability of default over a stated horizon or lifetime term structure |
| LGD        | Loss given default after recoveries and costs, as % of EAD              |
| EAD        | Exposure at default, including expected draw of undrawn                 |
| CCF        | Credit conversion factor on undrawn commitments                         |
| EIR        | Effective interest rate used to discount IFRS 9 cash shortfalls         |
| SICR       | Significant increase in credit risk since initial recognition           |
| PIT / TTC  | Point-in-time vs through-the-cycle PD philosophy                        |
| EL         | Expected loss, typically PD×LGD×EAD; pricing uses a product-life view   |
| PAR30      | Portfolio at risk: balances with DPD ≥ 30                               |
| MOB        | Months on book since origination / first disbursement                   |
| PSI        | Population stability index for model input mix                          |
| STP        | Straight-through processing with no human credit touch                  |
| EWS        | Early warning system on performing or early-delinquent book             |
| PTP        | Promise to pay in collections                                           |
| FOIR / DSR | Fixed-obligation / debt-service ratio vs income                         |

# 16. System architecture (for developers and system admins)

This section is the build-and-run view of the same schema. It is a
reference architecture, not a mandated vendor stack. Swap Postgres for
an existing core-banking ledger if the institution already has one; do
not invent a second system of record for principal, interest, and DPD.

## 16.1 Architecture principles

- Bounded contexts over a monolith of everything, but a modular monolith
  is acceptable until team and scale force a split. Do not start with 18
  microservices and no domain language.

- Write path is transactional and synchronous only where the customer is
  waiting (KYC, decision). Heavy work (OCR, bureau waterfall, ECL batch,
  EWS rescoring) is asynchronous behind an event bus.

- One system of record per fact. Servicing owns balances and DPD.
  Decision service owns the decision record. Document service owns blobs
  and forensic results. Scores are immutable append-only facts.

- Outbound vendor calls go through an integration adapter with timeouts,
  circuit breakers, idempotency keys, and a vendor-simulator for lower
  environments.

- PII and raw ID numbers never land in the warehouse, logs, or feature
  store in clear. Hash or tokenise at the edge.

- Every state change emits a domain event. Dashboards, IFRS 9, EWS, and
  collections subscribe; they do not scrape another service’s database.

## 16.2 Logical layers

| **Layer**       | **Responsibility**                                                    | **Typical components**                           |
|-----------------|-----------------------------------------------------------------------|--------------------------------------------------|
| Channel         | Capture applications, vKYC, servicing self-serve, collector workspace | Mobile/web apps, agent portal, partner API, USSD |
| Edge            | Authn/z, WAF, rate limit, mTLS, request ID                            | API gateway, IdP, bot/device fingerprint         |
| Experience APIs | BFF per channel; orchestrate use-case calls                           | Origination BFF, Collections BFF                 |
| Domain services | Own entities and invariants listed in §3                              | See service catalog below                        |
| Decision & ML   | Rules + models + explanations + registry                              | Decision engine, model serving, feature store    |
| Integration     | Vendors and core systems                                              | Adapters: KYC, bureau, AA, payments, CBS, SMS    |
| Async fabric    | Events, jobs, outbox                                                  | Kafka/NATS + workers + scheduler                 |
| Data            | OLTP, objects, search, analytics, features                            | See data plane                                   |
| Control plane   | Config, policy parameters, secrets, deploy                            | GitOps, parameter service, vault                 |

## 

## 

## 

## 16.3 Service catalog (bounded contexts)

| **Service**     | **Owns**                                         | **Sync API (examples)**                                  | **Emits**                                                |
|-----------------|--------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------|
| party-identity  | PARTY, identity, biometric refs, screening cases | POST /parties, POST /kyc/sessions, GET /parties/{id}/kyc | PartyCreated, KycVerified, KycFailed, ScreenHit          |
| document-intel  | DOCUMENT, forensic results, OCR fields           | POST /docs, GET /docs/{id}, POST /docs/{id}/verify       | DocumentReceived, ForensicCompleted, PackComplete        |
| fraud           | signals, graph edges, composite score            | POST /fraud/score, GET /fraud/{appId}                    | FraudScored, FraudCaseOpened                             |
| origination     | APPLICATION, declarations, status machine        | POST /applications, PATCH status, GET case file          | ApplicationSubmitted, ApplicationCancelled               |
| decision        | CREDIT_DECISION_RECORD, rules, overrides         | POST /decide, POST /override                             | CreditDecided, OfferIssued, OverrideRecorded             |
| pricing-limit   | grids, limit calc, EIR/APR build-up              | POST /price, POST /limit                                 | PriceQuoted, LimitBound                                  |
| agreement       | e-sign, mandate, conditions precedent            | POST /contracts, POST /mandates                          | ContractSigned, CpSatisfied                              |
| servicing (SoR) | ACCOUNT, schedule, payment, DPD                  | GET /accounts, POST /disburse (or CBS)                   | AccountBooked, PaymentPosted, PaymentBounced, DpdChanged |
| collateral      | valuations, LTV, insurance                       | POST /collateral, POST /revalue                          | CollateralUpdated, LtvBreached                           |
| ifrs9-ecl       | stage, ECL runs, scenarios                       | POST /ecl/run, GET /positions                            | StageMigrated, EclPosted                                 |
| monitoring-ews  | EWS scores, watchlist                            | GET /ews/{accountId}                                     | EwsBandChanged, Watchlisted                              |
| collections     | cases, treatments, PTP, scores                   | POST /cases, POST /treatments                            | CaseOpened, PtpRecorded, TreatmentApplied                |
| model-platform  | registry, features, scoring runtime              | POST /score/{modelKey}                                   | ModelScored, DriftAlerted                                |
| workflow        | human queues, SLA, maker-checker                 | task APIs                                                | TaskAssigned, TaskCompleted                              |
| notification    | SMS, email, push, in-app                         | POST /notify                                             | NotificationSent                                         |
| audit-ledger    | immutable decision and access log                | append-only internal                                     | AuditAppended                                            |

Servicing may be the existing core banking system (CBS). If so,
origination books via a controlled adapter and consumes payment/DPD
events from CBS. Never duplicate accrued interest in origination.

## 16.4 Reference runtime topology

Internet / partners → WAF + API gateway (JWT/mTLS, rate limits,
correlation-id) → channel BFFs → domain services. Services talk to each
other via sync HTTP/gRPC only for request/response on the customer path,
and via the event bus for everything else. Workers sit off the bus:
forensic worker, bureau waterfall worker, ECL engine, nightly EWS
scorer, collection dialler feed, warehouse loader.

ASCII view of the happy origination path:

*Channel → BFF → origination.create*

*→ party-identity.startKyc → vendors (eKYC, liveness, sanctions)*

*→ document-intel.ingest → object store + forensic worker*

*→ fraud.score → graph + device + velocity*

*→ decision.decide → bureau adapter + model-platform + pricing-limit*

*→ agreement + mandate → disbursement adapter → CBS/servicing*

*→ events: AccountBooked → ifrs9-ecl day-1 + warehouse + EWS seed*

## 16.5 Data plane

| **Store**                                   | **What lives there**                           | **Notes for admins**                                              |
|---------------------------------------------|------------------------------------------------|-------------------------------------------------------------------|
| OLTP (PostgreSQL or CBS + Postgres sidecar) | Party, application, decision, case, parameters | Strong consistency; row-level security by tenant/branch if needed |
| Object store (S3/MinIO)                     | Raw docs, vKYC video, model artefacts          | SSE-KMS; bucket per class; no public ACLs; signed URLs            |
| Document metadata DB                        | Hashes, forensic JSON, retention class         | Separate from blob; legal hold flag                               |
| Event log (Kafka)                           | Domain events, outbox relay                    | Compacted topics for current score; retention on PII topics short |
| Feature store (Feast/Tecton/Redis+PG)       | Online features for scoring                    | Point-in-time correctness for training                            |
| Model registry + artefact store             | Versions, cards, thresholds                    | Immutable; promote via GitOps                                     |
| Search (OpenSearch)                         | Case file retrieval, collector search          | Redact national IDs                                               |
| Warehouse / lakehouse                       | Snapshots, vintages, ECL traces, features      | No raw ID; hashed party_id                                        |
| Secrets (Vault/cloud KMS)                   | Vendor API keys, DB creds, signing keys        | Short TTL; no secrets in app config maps                          |
| Redis / cache                               | Sessions, idempotency keys, rate counters      | Not a source of truth for balances                                |

### Outbox pattern (mandatory)

Domain service writes business row + outbox row in one DB transaction. A
relay publisher pushes to Kafka. Consumers are idempotent on event_id.
This avoids dual-write loss between Postgres and the bus.

### Suggested core OLTP schemas (logical)

party, party_identity, party_address, related_party, sanctions_screen,
application, application_status_hist, app_declaration, document,
doc_forensic, fraud_signal, fraud_score, bureau_pull, credit_score,
affordability, credit_decision, pricing_quote, account,
repayment_schedule, payment, dpd_snapshot, collateral, ifrs9_position,
ecl_run, ecl_scenario_result, ews_score, collection_case,
collection_score, treatment, model_registry, policy_parameter,
audit_event, integration_outbox, idempotency_key.

Physical DDL should add: tenant_id if multi-lender,
created_at/updated_at, created_by, row_version, and for scores:
model_id, model_version, as_of_ts, feature_snapshot_id, reason_codes
jsonb.

## 16.6 Event catalog (minimum)

| **Event**               | **When**              | **Key payload**                   | **Typical consumers**           |
|-------------------------|-----------------------|-----------------------------------|---------------------------------|
| ApplicationSubmitted    | Customer submits      | app_id, party_id, product, amount | KYC, docs, fraud                |
| KycVerified / KycFailed | Identity case closes  | party_id, method, scores          | origination, decision           |
| ForensicCompleted       | Doc check done        | doc_id, tamper_score              | origination gate                |
| FraudScored             | Fusion complete       | app_id, composite, bands          | decision, SIU workflow          |
| BureauReceived          | Vendor return         | app_id, bureau, score             | decision, feature store         |
| CreditDecided           | Approve/decline/refer | decision, limit, price, reasons   | agreement, notify, warehouse    |
| AccountBooked           | Funds + account exist | account_id, principal, EIR        | IFRS 9, EWS seed, warehouse     |
| PaymentPosted / Bounced | Servicing             | amount, due_dt, channel           | DPD engine, EWS, collections    |
| DpdChanged              | DPD bucket moves      | old, new, balance                 | IFRS 9 SICR, collections        |
| StageMigrated           | 1↔2↔3                 | from, to, trigger                 | finance, RM, collections        |
| EwsBandChanged          | G/A/R change          | band, drivers                     | notify, workflow, freeze limits |
| CaseOpened              | Collections start     | case_id, entry_dpd                | dialler, collector UI           |
| EclPosted               | Run complete          | run_id, stage, ecl                | GL adapter, warehouse           |

Event envelope: event_id (ULID), event_type, occurred_at, producer,
tenant_id, aggregate_type, aggregate_id, schema_version, correlation_id,
causation_id, payload. Schema-registry the payload. PII fields encrypted
or omitted; consumers that need PII call party-identity with
authorisation.

## 16.7 Integration architecture

| **Adapter**                       | **Direction** | **Pattern**                                                      | **Ops concerns**                                |
|-----------------------------------|---------------|------------------------------------------------------------------|-------------------------------------------------|
| eKYC / ID authority / DigiLocker  | Outbound      | Sync on customer path; cache evidence id                         | Legal retention; vendor SLA; sandbox identities |
| Liveness / face match             | Outbound      | Sync; store vendor reference not raw biometrics if policy allows | GPU vendor quotas; spoof updates                |
| Sanctions / PEP / media           | Outbound      | Sync + nightly rescreen of book                                  | Fuzzy-match alert volume                        |
| Credit bureaus                    | Outbound      | Soft pull pre-qual; hard pull pre-decision; waterfall            | Consent, enquiry footprint, cost                |
| Account aggregator / open banking | Outbound      | Consent grant then async data ready                              | Consent expiry jobs; refresh tokens             |
| Payroll / employer / GST          | Outbound      | Sync or batch                                                    | Employer coverage gaps                          |
| CBS / ledger / payments           | Both          | Book, disburse, collect, refund via idempotent API               | Reconciliation every day; NACK handling         |
| Mandate / NACH / debit order      | Both          | Register then listen to presentation results                     | Fail codes feed EWS                             |
| SMS / email / WhatsApp / dialler  | Outbound      | Async; preference + quiet hours                                  | DND, conduct caps                               |
| GL / finance                      | Outbound      | ECL and interest postings at month-end + events                  | Tie-out to warehouse                            |

Every adapter implements: idempotency key, timeout + retry with jitter,
circuit breaker, dead-letter queue, structured error taxonomy (TIMEOUT,
REJECTED, SUSPECT_FRAUD, PARSE_FAIL), and a contract test against a
recorded fixture. Lower environments never call production bureaus with
real customers.

## 16.8 Decision engine internals

The decide() call is an orchestration, not a single model. Order: load
application snapshot → policy knockouts (rules) → require gates G1–G5 →
fetch or compute features → application PD + collection propensity +
fraud already on file → affordability → limit → price → compose
CREDIT_DECISION_RECORD → persist + emit. Rules live in a versioned
policy pack (JSON/YAML or a BRE) promoted like code. Models are invoked
only through model-platform so that model_id and feature_snapshot_id are
always stamped.

Synchronous latency budget (p95, origination decide path excluding
vendor): \< 400 ms in-process once bureau and KYC results are already on
the file. If a vendor is still running, the BFF waits on a job, not on
an open HTTP call stacked five vendors deep.

## 16.9 Batch and near-real-time jobs

| **Job**                  | **Trigger**                       | **Input**                          | **Output**                    |
|--------------------------|-----------------------------------|------------------------------------|-------------------------------|
| Day-1 ECL                | AccountBooked                     | origination PD/LGD/EAD             | ifrs9_position Stage 1        |
| EWS score all performing | Daily 01:00 + event on bounce     | payments, AA refresh, bureau delta | ews_score + band events       |
| Behavioural PD refresh   | Monthly / event                   | MOB performance features           | credit_score type=BEHAVIOURAL |
| SICR + official ECL      | Month-end close calendar          | book snapshot + scenarios          | ecl_run, GL extract           |
| Intra-month ECL flash    | Weekly                            | same engine, unofficial            | risk pack                     |
| Sanctions rescreen       | Nightly + list update             | active parties                     | new hits → workflow           |
| Re-KYC due               | Nightly                           | refresh SLA                        | tasks                         |
| Collection queue build   | Hourly / after score              | cases + propensity                 | dialler / agent lists         |
| Warehouse load           | Continuous CDC + nightly snapshot | OLTP + events                      | analytics marts               |
| Model monitoring         | Daily                             | scores vs outcomes lagged          | PSI, Gini, alerts             |

## 16.10 Security architecture

- Identity: OIDC for staff; customer auth separate (OTP + device). Staff
  roles: onboarding analyst, underwriter, override approver, collector,
  SIU, finance closer, model validator, platform admin. Least privilege
  via RBAC + resource attributes (branch, product).

- Service-to-service: mTLS or mesh identity. No shared DB users across
  services.

- Data classes: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED (PII,
  biometrics, bureau). RESTRICTED columns encrypted; access logged to
  audit-ledger.

- National IDs and raw bureau files: tokenise; analytics uses party_key.
  Documents scanned for malware on ingest; content-type allowlist.

- Secrets rotation 30–90 days; vendor keys per environment. Break-glass
  documented.

- Network: private subnets for data stores; egress allowlist to vendors;
  no SSH bastion without PAM recording.

- Change: policy parameters and model thresholds change via signed
  promotion, not by updating a row in production UI without dual
  control.

- Residency: keep PII and documents in-region. Warehouse in same region.

## 16.11 Environments and promotion

| **Environment** | **Data**                      | **Vendors**                | **Purpose**                             |
|-----------------|-------------------------------|----------------------------|-----------------------------------------|
| dev             | Synthetic fixtures            | Simulators only            | Engineers                               |
| test / CI       | Synthetic + contract fixtures | Simulators + recorded HTTP | PR checks                               |
| uat / preprod   | Anonymised production-shaped  | Vendor UAT creds           | Credit/ops acceptance                   |
| prod            | Live                          | Live                       | Business                                |
| prod-analytics  | Masked replica / warehouse    | None                       | Data science; no path back to customers |

Promote: Git → CI (unit, contract, schema compat) → build image → deploy
to test → migrate → UAT sign-off for policy/model → prod canary → full.
Database migrations expand-then-contract. Event schemas are additive;
breaking changes get a new event_type or schema_version with dual
publish.

## 16.12 Observability and operations

- Every request carries correlation_id from gateway; every event carries
  it. Trace origination as one distributed trace across BFF, KYC, fraud,
  decision.

- RED metrics per service (rate, errors, duration) plus business SLIs:
  KYC p95, decide p95, book success, EWS freshness, ECL job success,
  payment event lag.

- Alert on: vendor error budget burn, outbox lag, consumer lag, EWS job
  missed SLA, ECL run fail before close, poison messages in DLQ, PSI
  breach, disk on object store.

- Runbooks: bureau down (fail closed vs cached soft-pull policy), AA
  consent storm, CBS book timeout (compensate, do not double-disburse),
  Kafka partition hot key (party_id hash).

- Reconciliation: daily CBS balance vs account table vs warehouse; ECL
  stock vs GL; document hash inventory vs object store.

- Backups: PITR on OLTP; object-store versioning; tested restore
  quarterly. Event log is not the backup of OLTP.

- Capacity: score batch is CPU/RAM heavy — isolate EWS/ECL workers from
  origination pods so month-end does not kill take-up.

## 16.13 API conventions

- External (partner/channel): REST, JSON, idempotency-key header on
  POST, problem+json errors, cursor pagination, ISO-8601 timestamps in
  UTC.

- Internal: REST or gRPC; same idempotency for money and vendor calls.

- Version /v1; additive fields only. Deprecate with a sunset header.

- AuthZ checked in the service, not only at the gateway.

- Example resources: /v1/applications, /v1/applications/{id}/decision,
  /v1/accounts/{id}/ews, /v1/accounts/{id}/ecl, /v1/collection-cases.

## 16.14 Reference technology choices (swappable)

| **Concern**               | **Sensible default**                                | **Avoid**                              |
|---------------------------|-----------------------------------------------------|----------------------------------------|
| Language (domain)         | Java/Kotlin or Go for SoR; Python for ML workers    | Five languages on the customer path    |
| OLTP                      | PostgreSQL 16+                                      | Mongo as ledger of balances            |
| Bus                       | Kafka (or cloud equivalent)                         | DB polling as the only integration     |
| Objects                   | S3-compatible + KMS                                 | App server local disk                  |
| Orchestration of long KYC | Temporal / Camunda / durable workflow               | Sleeping HTTP threads                  |
| Model serve               | ONNX/sklearn in model-platform; not Jupyter on prod | Credit officer pastes score from Excel |
| IaC                       | Terraform/Pulumi + GitOps                           | Clickops in the cloud console          |
| Containers                | Kubernetes with HPA on origination; Jobs for ECL    | ECL inside the API replica set         |

## 16.15 Deployment sketch

Per environment: EKS/GKE/AKS or equivalent. Namespaces: edge,
origination, risk, servicing-adapter, data, jobs. Separate node pool for
scoring/ECL. Ingress only to gateway. Managed Postgres multi-AZ. Kafka
multi-AZ. Object store private. CI runners have no prod credentials;
deploy role is assumed by GitOps controller. Platform admin access via
PAM, not standing kubeconfig on laptops.

## 16.16 What the system admin actually runs day-to-day

- Watch golden signals and business SLIs, not only CPU.

- Vendor status page + our adapter error rates.

- Outbox and consumer lag dashboards.

- Certificate and secret expiry calendar.

- Month-end: freeze window for ECL close; confirm job completed and GL
  file hash handed to finance.

- After model or policy promote: confirm decide() error rate and
  distribution of grades did not cliff.

- Quarterly: restore test, access review, fire-drill bureau-down and
  CBS-timeout.

## 16.17 Suggested repo / ownership map

| **Repo or pack**      | **Owner**                     | **Contains**                        |
|-----------------------|-------------------------------|-------------------------------------|
| los-origination       | Lending engineering           | application, BFF, agreement         |
| los-party-kyc         | Identity engineering          | party, screening adapters           |
| los-fraud-docs        | Risk engineering              | documents, forensics, fraud         |
| los-decision          | Credit engineering            | rules, decide API, pricing          |
| los-servicing-adapter | Core / payments               | CBS anti-corruption layer           |
| los-ifrs9             | Finance engineering + risk    | ECL engine, staging                 |
| los-ews-collections   | Collections engineering       | EWS, cases, treatments              |
| los-model-platform    | ML platform                   | registry, serving, features         |
| los-events-contracts  | Platform                      | Avro/JSON schemas, compatibility CI |
| los-infra             | SRE                           | Terraform, Kafka topics, alerts     |
| los-policy-packs      | Credit risk (with eng review) | Thresholds, grids, knockouts        |

# 17. Closing note

A loan system is not a form plus a bureau score. It is a chain of
evidence (who is this?), integrity (is the file real?), capacity and
willingness (will they pay?), price and capital (are we paid for the
risk?), continuous observation (has the risk moved?), and intervention
(can we still collect, and at what cost?). The schema above is the
minimum object model, metric set, and runtime architecture that lets
that chain be audited, improved, and operated.

Engineering should implement the service catalog, event envelope,
outbox, and adapters first. Credit and finance should own policy packs
and model versions that deploy through the same pipeline. If those two
planes stay in separate languages, the architecture will drift into
another siloed scoring spreadsheet within a year.
