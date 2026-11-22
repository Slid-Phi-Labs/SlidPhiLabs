// pricing-data.mjs — hand-synced JS mirror of pricing.json (the machine source).
// SEEDED 2026-11-19 as a verbatim copy of pricing.json; there is NO build step
// that generates this file. When a price changes, edit pricing.json first,
// then update this file by hand to match, then run scripts/check-prices.mjs.
// Disputed figures live under PRICING.disputed and are NEVER canonical.
export const PRICING = 
{
  "updated": "2026-11-19",
  "inbox": "corey@slidphilabs.com",
  "site": "https://www.slidphilabs.com",
  "methods": "https://www.slidphilabs.com/METHODS.md",
  "rule": "One Shared Spine, three heads, four doors. Never expand. DECODE_OK. Door 1 PCC: metered $0.25/GB of input, first 1 GB free once per IP address (lifetime, no monthly reset); Pro $25/mo including 100 GB, then $0.20/GB; customer-set monthly spend cap (default $25), alert at 80% of cap/allowance; x402 per-call for agents, Stripe monthly for humans. TRUSTREAM rides the PCC plan. Door 2 TNSSRC: AGPL $0 · closed grant $369/product/year via the tnssrc-grant SKU (TNSSRC 0.1.0 only) · founding $190 for the first 10 grants · 3+ products $390 each. Silesia 43,724,575 bytes, verified 12/12 decode+SHA-256. Door 3 TRUSTREAM: included with PCC. Door 4 pulsar: $0 GPLv3 · closed embed $490/product/year via the unified grant. Door 5 PERsiST (Persistent Super Intelligence; memory that starts at BASE): Solo $13.31 · Crew $39 · Team $49 · psi Lab Pass $490/yr. First 5,000 tokens/day folded free. Rider: Solo $12/mo ($120/yr, 1 identity, 500 verifications/month) · Team $49/mo ($490/yr, 10 identities, 5,000 verifications/month, Warrant included) · Fleet $199/mo ($1,990/yr, 100 identities, 50,000 verifications/month, Warrant + fleet watch included); overage $0.02 per verification, customer-set monthly cap (default 2× plan price), alert at 80%; free: 1 identity, 100 verifications/month, no L3/L4 attestation. Warrant: $8/month add-on to Solo ($80/year), included in Team and Fleet, no standalone SKU. Chamber $20/mo · $200/yr; 24-hour try; opening already-sealed blobs free forever; sealing not metered. CuNi Studio $0 · closed-app grant $490/app/year · per-check API: first 100 checks/month free, then $0.05 per check. Lab Pass $495/yr (Chamber 1 year + Rider Solo 1 year + PSI Meter 1 seat 1 year + Warrant add-on 1 year; parts sum $650; PCC/compression out; no monthly version; Foundry+ retired). Quikgater $0.02 per fetch; first 100 fetches/month free; customer-set monthly cap (default $10), alert at 80%. TRU8 is the zeros specialist. AWARE is a retired alias for PCC. PSI Meter $25/seat/mo, $250/seat/yr: 250,000 logged calls/month included, then $2 per additional 100,000 calls; free: 1 seat, 10,000 calls/month, 7-day retention. PSI Embed: unified grant $490/product/year; psi-month/psi-year retired. PSI Org $79/mo. GitDepot live and functional: $15/seat/mo, $150/seat/yr; 100 GB pooled storage included, then $0.10/GB/month overage; free: 1 team, 3 seats, 10 GB, 30-day audit retention; invite-only, contact corey@slidphilabs.com. ACP $0, open standard; ACP Conformant certification $990 one-time (3 free pilot certifications, assessment criteria published). TeachAid student $6/mo, $60/yr; free: 1 course, text-only cited answers, no voice; institutional pilot $2,500 per campus per semester, up to 500 students, onboarding included. Consulting $175/hour, 2-hour minimum, scoped SOW. OSS support $199/year per public library. Unified grant $490/product/year; founding $190 for the first 10 grants; 3+ products $390 each; written grant, human-fulfilled, one product + one year per grant, renewal at then-current schedule price. Tollkeeper: identity $0.005/check, first 100/mo free · lookup $0.02, listing free, Promote $9/mo · escrow 1% · grant $0.01 issue, $0.005 check · bond 1% at stake · memory transfer $0.02 hosted, format free. (Exactness Toll 5 is disputed — see \"disputed\"; no Tollkeeper figure is stated here as canonical beyond the undisputed tolls.) AwLPay: free 0.5%/payment, no fixed fee · Pro $39/mo · L33t $799/mo · $1 minimum send. CuNi hosted calls: check $0.05 (first 100/mo free) · translate $0.10 · ingest $0.10 · money $0.25 · time $0.25 · parity $0.25 · chain $0.50 · ship $0.50 · audit $1.00 · squeeze $0.10 · Studio $0 · closed-app grant $490/yr. Every meter states its free allowance, a customer-set cap, and an 80% alert. Cap defaults are stated per meter where they apply (PCC $25, Rider 2x plan price, Quikgater $10).",
  "measured": {
    "silesia_raw": 211938580,
    "zpaq_m5": 39112870,
    "xz9": 48795480,
    "calgary_raw": 3141622,
    "loom_hangry": 980769,
    "gzip9_calgary": 1017680,
    "aware_xz1_retired": 47752368,
    "pcc": 51498645,
    "pulsar": 55745438,
    "champ": 50541135,
    "gzip9": 67631990,
    "bzip29": 54506769
  },
  "math": {
    "chamber_month": 20,
    "chamber_year": 200,
    "pcc_pro_month": 25,
    "pcc_pro_overage_gb": 0.2,
    "pcc_meter_gb": 0.25,
    "lab_pass_year": 495,
    "rider_solo": 12,
    "rider_team": 49,
    "rider_fleet": 199,
    "tnssrc_grant_year": 369,
    "tnssrc_bakeoff_month": 19.31,
    "pulsar_embed_year": 490,
    "cuni_exception_year": 490,
    "psi_meter_seat": 25,
    "psi_org": 79,
    "warrant_addon": 8,
    "warrant_addon_year": 80,
    "cuni_check": 0.05,
    "cuni_translate": 0.1,
    "cuni_ingest": 0.1,
    "cuni_money": 0.25,
    "cuni_time": 0.25,
    "cuni_parity": 0.25,
    "cuni_chain": 0.5,
    "cuni_ship": 0.5,
    "cuni_audit": 1.0,
    "cuni_squeeze": 0.1,
    "quikgater_fetch": 0.02,
    "pcc_pro_year": 250,
    "rider_solo_year": 120,
    "rider_team_year": 490,
    "rider_fleet_year": 1990,
    "rider_ops_month": 37,
    "rider_ops_year": 369,
    "psi_meter_year": 250,
    "gitdepot_seat_year": 150,
    "teachaid_student_year": 60,
    "pulsar_binary": 0,
    "lab_pass_parts_sum": 650,
    "tollkeeper_identity": 0.005,
    "tollkeeper_lookup": 0.02,
    "tollkeeper_promote": 9,
    "tollkeeper_escrow_pct": 1,
    "tollkeeper_grant_issue": 0.01,
    "tollkeeper_grant_check": 0.005,
    "tollkeeper_bond_pct": 1,
    "tollkeeper_memory_transfer": 0.02,
    "tollkeeper_pcc_compress": 0.01,
    "tollkeeper_pcc_verify": 0.02,
    "tollkeeper_attest_notarize": 0.01,
    "tollkeeper_exactodds_draw": 0.01,
    "tollkeeper_exactodds_resolve": 0.02,
    "tollkeeper_cuni_proof": 0.1,
    "tollkeeper_trustream_pack": 0.01,
    "tollkeeper_chamber_seal": 0.02,
    "tollkeeper_awlpay_quote": 0.005,
    "awlpay_free_pct": 0.5,
    "awlpay_pro": 39,
    "awlpay_l33t": 799,
    "awlpay_min_send": 1,
    "gitdepot_seat": 15,
    "teachaid_student": 6,
    "teachaid_pilot": 2500,
    "grant_year": 490,
    "grant_founding": 190,
    "grant_3plus": 390,
    "consulting_hour": 175,
    "oss_support_year": 199
  },
  "products": {
    "pcc": {
      "name": "PCC",
      "acronym": "lossless compressor",
      "engine": "served",
      "version": "1.19.2",
      "page": "https://www.slidphilabs.com/pcc",
      "meter": {
        "usd_per_gb_input": 0.25,
        "free_gb": 1,
        "free_window": "lifetime",
        "free_scope": "ip",
        "cap_default_usd": 25,
        "alert_at_pct": 80,
        "settlement": "x402 per-call for agents; Stripe monthly for humans"
      },
      "plans": {
        "meter": {
          "sku": "pcc-meter",
          "usd_per_gb": 0.25,
          "free_gb": 1,
          "free_window": "lifetime",
          "free_scope": "ip",
          "stripe": "https://www.slidphilabs.com/pps",
          "plain": "Metered $0.25/GB of input, first 1 GB free once per IP address (lifetime, no monthly reset). Customer-set monthly spend cap (default $25), alert at 80%."
        },
        "pro_month": {
          "sku": "pcc-pro",
          "usd": 25,
          "included_gb": 100,
          "overage_usd_per_gb": 0.2,
          "stripe": "https://www.slidphilabs.com/pay?sku=pcc-pro"
        },
        "pro_year": {
          "sku": "pcc-pro-year",
          "usd": 250,
          "included_gb_per_month": 100,
          "overage_usd_per_gb": 0.2,
          "stripe": "https://www.slidphilabs.com/pay?sku=pcc-pro-year"
        }
      }
    },
    "chamber": {
      "name": "Chamber",
      "trial_hours": 24,
      "open_policy": "keys_only",
      "plans": {
        "month": {
          "sku": "chamber-month",
          "usd": 20,
          "stripe": "https://www.slidphilabs.com/pay?sku=chamber-month"
        },
        "year": {
          "sku": "chamber-year",
          "usd": 200,
          "stripe": "https://www.slidphilabs.com/pay?sku=chamber-year"
        }
      },
      "plain": "24-hour try. Opening already-sealed blobs free forever. Sealing not metered."
    },
    "rider": {
      "name": "Agent Rider Network",
      "page": "https://www.slidphilabs.com/rider",
      "plans": {
        "solo": {
          "sku": "rider-solo",
          "usd": 12,
          "usd_year": 120,
          "identities": 1,
          "verifications_per_month": 500,
          "stripe": "https://www.slidphilabs.com/pay?sku=rider-solo"
        },
        "team": {
          "sku": "rider-team",
          "usd": 49,
          "usd_year": 490,
          "identities": 10,
          "verifications_per_month": 5000,
          "warrant": "included",
          "stripe": "https://www.slidphilabs.com/pay?sku=rider-team"
        },
        "fleet": {
          "sku": "rider-fleet",
          "usd": 199,
          "usd_year": 1990,
          "identities": 100,
          "verifications_per_month": 50000,
          "warrant": "included",
          "fleet_watch": "included",
          "stripe": "https://www.slidphilabs.com/pay?sku=rider-fleet"
        }
      },
      "overage": {
        "usd_per_verification": 0.02,
        "cap_default": "2x plan price",
        "alert_at_pct": 80
      },
      "free": {
        "identities": 1,
        "verifications_per_month": 100,
        "l3_l4_attestation": false
      }
    },
    "rider_ops": {
      "name": "Rider Ops",
      "needs": "rider",
      "page": "https://www.slidphilabs.com/rider",
      "availability": "Fleet watch included in Rider Fleet. Standalone: $37/month, $369/year (live catalog SKUs rider-ops-month / rider-ops-year).",
      "plans": {
        "month": {
          "sku": "rider-ops-month",
          "usd": 37
        },
        "year": {
          "sku": "rider-ops-year",
          "usd": 369
        }
      }
    },
    "warrant": {
      "name": "Warrant",
      "needs": "rider",
      "page": "https://www.slidphilabs.com/warrant",
      "availability": "Warrant add-on: $8/month to Rider Solo ($80/year). Included in Rider Team and Fleet. No standalone SKU.",
      "plans": {
        "addon_month": {
          "sku": "warrant-addon",
          "usd": 8,
          "stripe": "https://www.slidphilabs.com/pay?sku=warrant-addon"
        },
        "addon_year": {
          "sku": "warrant-addon",
          "usd": 80,
          "stripe": "https://www.slidphilabs.com/pay?sku=warrant-addon"
        }
      }
    },
    "cuni_exception": {
      "name": "CuNi closed-app exception",
      "sku": "cuni-exception",
      "usd": 490,
      "stripe": "https://www.slidphilabs.com/pay?sku=cuni-exception",
      "plain": "Unified grant $490/app/year. Written grant, human-fulfilled, one product + one year per grant."
    },
    "pulsar_exception": {
      "name": "pulsar closed-embed exception",
      "sku": "pulsar-exception",
      "usd": 490,
      "stripe": "https://www.slidphilabs.com/pay?sku=pulsar-exception",
      "grants": "One closed-source product, one year, via the unified grant ($490/product/year; founding $190 for the first 10 grants; 3+ products $390 each). pulsar stays GPLv3.",
      "binary": { "usd": 0, "license": "GPLv3", "plain": "pulsar binary $0 under GPLv3." }
    },
    "tnssrc": {
      "name": "TNSSRC",
      "acronym": "TriNeural Shared Spine Row Compression",
      "engine": "local npcc",
      "page": "https://www.slidphilabs.com/silesia",
      "silesia_bytes": 43724575,
      "silesia_verified": "12/12 decode+SHA-256",
      "agpl": 0,
      "grant": {
        "sku": "tnssrc-grant",
        "usd": 369,
        "stripe": "https://www.slidphilabs.com/pay?sku=tnssrc-grant",
        "plain": "Unified grant, one product, one year. TNSSRC 0.1.0 only. Written grant, human-fulfilled. Founding $190 for the first 10 grants; 3+ products $390 each; renewal at then-current schedule price."
      },
      "bakeoff": {
        "usd_per_month": 19.31,
        "plain": "TNSSRC bake-off $19.31/mo."
      }
    },
    "lab_pass": {
      "name": "Lab Pass Year",
      "sku": "lab-pass",
      "usd": 495,
      "stripe": "https://www.slidphilabs.com/pay?sku=lab-pass",
      "includes": [
        "chamber",
        "rider-solo",
        "psi-meter",
        "warrant-addon"
      ],
      "excludes": [
        "pcc",
        "compression"
      ],
      "parts_sum": 650,
      "note": "Lab Pass is Chamber (1 year) + Rider Solo (1 year) + PSI Meter 1 seat (1 year) + Warrant add-on (1 year). Parts sum $650; bundle $495 (24% off). PCC/compression is out. No monthly version. Foundry+ retired."
    },
    "consulting": {
      "name": "Lab consulting ($175/hour, 2-hour minimum, scoped SOW)",
      "sku": "consulting",
      "usd_per_hour": 175,
      "minimum_hours": 2,
      "stripe": "https://www.slidphilabs.com/pay?sku=consulting"
    },
    "quikgater": {
      "name": "Quikgater",
      "sku": "quikgater",
      "kind": "usage",
      "page": "https://www.slidphilabs.com/quikgater",
      "x402": "https://quikgater-worker.ceedotrock.workers.dev/",
      "usd_per_fetch": 0.02,
      "free_fetches_per_month": 100,
      "cap_default_usd": 10,
      "alert_at_pct": 80,
      "plain": "$0.02 per fetch; first 100 fetches/month free; customer-set monthly cap (default $10), alert at 80%."
    },
    "tollkeeper": {
      "name": "Tollkeeper",
      "page": "https://www.slidphilabs.com/tollkeeper",
      "tolls": {
        "toll_1_identity": { "usd_per_check": 0.005, "free_per_month": 100, "plain": "Identity check $0.005/check, first 100/mo free." },
        "toll_2_lookup": { "usd_per_lookup": 0.02, "listing": "free", "promote_usd_per_month": 9, "plain": "Lookup $0.02, listing free, Promote $9/mo." },
        "toll_3_escrow": { "pct": 1, "plain": "Escrow routing 1%." },
        "toll_4_grant": { "usd_per_issue": 0.01, "usd_per_check": 0.005, "plain": "Grant $0.01 issue, $0.005 check." },
        "toll_6_bond": { "pct_at_stake": 1, "plain": "Bond 1% at stake." },
        "toll_7_memory_transfer": { "usd_per_hosted_transfer": 0.02, "format": "free", "plain": "Memory transfer $0.02 hosted, format free." }
      },
      "tools": {
        "pcc_compress": { "usd": 0.01, "per": "MB in" },
        "pcc_verify": { "usd": 0.02 },
        "attest_notarize": { "usd": 0.01 },
        "exactodds_draw": { "usd": 0.01 },
        "exactodds_resolve": { "usd": 0.02 },
        "cuni_proof": { "usd": 0.1 },
        "trustream_pack": { "usd": 0.01, "per": "MB in" },
        "chamber_seal": { "usd": 0.02 },
        "awlpay_quote": { "usd": 0.005 }
      },
      "plain": "Tollkeeper protection tolls 1-4, 6, 7 and nine metered tools as listed. Toll 5 (exactness check) is DISPUTED and deliberately absent here — see top-level \"disputed\"."
    },
    "awlpay": {
      "name": "AwLPay",
      "page": "https://www.slidphilabs.com/awlpay",
      "free": { "pct_per_payment": 0.5, "fixed_fee": 0 },
      "plans": {
        "pro": { "usd_per_month": 39 },
        "l33t": { "usd_per_month": 799 }
      },
      "min_send_usd": 1,
      "plain": "AwLPay free 0.5%/payment, no fixed fee · Pro $39/mo · L33t $799/mo · $1 minimum send."
    },
    "oss_support": {
      "name": "OSS support",
      "sku": "oss-support",
      "usd_per_year": 199,
      "per": "public library",
      "stripe": "https://www.slidphilabs.com/pay?sku=oss-support",
      "plain": "OSS support $199/year per public library. Commercial support for an already-public GPLv3 library; no engine or secret extra engine is included."
    },
    "trustream": {
      "name": "TRUSTREAM",
      "included_with": "pcc",
      "page": "https://www.slidphilabs.com/trustream",
      "plain": "Live logs on the PCC plan. Not a second bill."
    },
    "cuni": {
      "name": "CuNi",
      "studio": 0,
      "exception": {
        "sku": "cuni-exception",
        "usd": 490
      },
      "page": "https://www.slidphilabs.com/cuni",
      "per_check": {
        "free_checks_per_month": 100,
        "usd_per_check": 0.05,
        "plain": "First 100 checks/month free, then $0.05 per check via x402."
      },
      "calls": {
        "check": { "usd": 0.05, "free_per_month": 100 },
        "translate": { "usd": 0.1 },
        "ingest": { "usd": 0.1 },
        "money": { "usd": 0.25 },
        "time": { "usd": 0.25 },
        "parity": { "usd": 0.25 },
        "chain": { "usd": 0.5 },
        "ship": { "usd": 0.5 },
        "audit": { "usd": 1.0 },
        "squeeze": { "usd": 0.1 },
        "plain": "CuNi hosted calls: check $0.05 (first 100/mo free) · translate $0.10 · ingest $0.10 · money $0.25 · time $0.25 · parity $0.25 · chain $0.50 · ship $0.50 · audit $1.00 · squeeze $0.10. Studio $0. CuNi is not free except trial usage and Studio."
      }
    },
    "psi_spend": {
      "name": "PSI Meter + Org",
      "acronym": "spend log for agents",
      "engine": "usage-line meter + 23-rule token economy + quarterly audits",
      "measured": {
        "input_output_ratio": "124:1",
        "cache_share": 0.94,
        "profiled_cost_fraction": 0.19,
        "basis": "5 sessions, 787.7M in / 6.35M out, Oct 2026; live provider rates",
        "marathon_example": "304M-token session about $116 profiled vs about $631 uncached (Sonnet-class rates)"
      },
      "page": "https://psi.slidphilabs.com/",
      "free": {
        "seats": 1,
        "calls_per_month": 10000,
        "retention_days": 7,
        "first_audit": true,
        "plain": "Free: 1 seat, 10,000 calls/month, 7-day retention. First audit free."
      },
      "plans": {
        "meter": {
          "sku": "psi-meter",
          "usd": 25,
          "usd_year": 250,
          "included_calls_per_month": 250000,
          "overage_usd_per_100k_calls": 2,
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-meter"
        },
        "org": {
          "sku": "psi-org",
          "usd": 79,
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-org"
        },
        "embed_grant": {
          "sku": "psi-embed-grant",
          "usd": 490,
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-embed-grant",
          "plain": "PSI Embed (shipped code): unified grant $490/product/year."
        }
      }
    },
    "persist": {
      "name": "PERsiST",
      "acronym": "Persistent Super Intelligence",
      "engine": "psi + spl-heart (LZMA-9 + PCC-CAE) + Warrant + CuNi",
      "page": "https://www.slidphilabs.com/persist",
      "domain": "https://persist.com",
      "free": {
        "tokens_folded_per_day": 5000,
        "plain": "First 5,000 tokens/day folded via spl-heart are free, no plan."
      },
      "plans": {
        "solo": {
          "sku": "psi-solo",
          "usd": 13.31,
          "usd_year": 99,
          "seats": 1,
          "includes": [
            "local spl-heart engine",
            "BASE-start memory built from a scan of your work",
            "Warrant gate",
            "CuNi receipts",
            "10 GB PCC compression/month"
          ],
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-solo"
        },
        "crew": {
          "sku": "psi-crew",
          "usd": 39,
          "seats": 6,
          "includes": [
            "shared heart.cae built from the crew's shared work",
            "slice loading per seat",
            "Warrant + CuNi receipts for all 6 seats",
            "200 GB PCC compression/month"
          ],
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-crew"
        },
        "team": {
          "sku": "psi-team",
          "usd": 49,
          "seats": 10,
          "includes": [
            "priority SLA",
            "policy customization",
            "SOC2/SIEM audit export",
            "dedicated Warrant ledger"
          ],
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-team"
        },
        "lab_pass": {
          "sku": "psi-lab-pass",
          "usd": 490,
          "includes": [
            "Chamber year",
            "PCC year",
            "psi Crew"
          ],
          "stripe": "https://www.slidphilabs.com/pay?sku=psi-lab-pass"
        }
      }
    },
    "unified_grant": {
      "name": "Unified closed-use grant",
      "sku": "unified-grant",
      "usd": 490,
      "founding_usd": 190,
      "founding_count": 10,
      "three_plus_usd_each": 390,
      "plain": "$490/product/year; founding $190 for the first 10 grants; 3+ products $390 each. Written grant, human-fulfilled, one product + one year per grant, renewal at then-current schedule price. Build-named: TNSSRC grants cover 0.1.0 only.",
      "covers": [
        "TNSSRC",
        "pulsar",
        "CuNi",
        "Chamber SDK",
        "Agent-Rider source",
        "Warrant source",
        "PSI Embed"
      ]
    },
    "gitdepot": {
      "name": "GitDepot",
      "status": "live and functional",
      "invite_only": true,
      "contact": "mailto:corey@slidphilabs.com",
      "page": "https://gitdepot.slidphilabs.com/",
      "plans": {
        "seat_month": {
          "sku": "gitdepot-seat",
          "usd": 15,
          "included_storage_gb_pooled": 100,
          "overage_usd_per_gb_per_month": 0.1
        },
        "seat_year": {
          "sku": "gitdepot-seat-year",
          "usd": 150,
          "included_storage_gb_pooled": 100,
          "overage_usd_per_gb_per_month": 0.1
        }
      },
      "free": {
        "teams": 1,
        "seats": 3,
        "storage_gb": 10,
        "audit_retention_days": 30
      },
      "plain": "$15/seat/month, $150/seat/year; 100 GB pooled storage included, then $0.10/GB/month overage. Free: 1 team, 3 seats, 10 GB, 30-day audit retention. Invite-only."
    },
    "acp": {
      "name": "ACP (Agent Commerce Protocol)",
      "price": 0,
      "kind": "open standard",
      "page": "https://acp.slidphilabs.com/",
      "certification": {
        "name": "ACP Conformant",
        "usd": 990,
        "kind": "one-time",
        "plain": "$990 one-time, listed with test framing: 3 free pilot certifications, assessment criteria published."
      },
      "plain": "No direct price ($0, open standard). ACP Conformant certification $990 one-time."
    },
    "teachaid": {
      "name": "TeachAid",
      "disputed": true,
      "dispute_note": "TeachAid Pro $9/mo vs student $6/mo — unresolved tier question; see top-level disputed object. No TeachAid price was changed.",
      "page": "https://www.slidphilabs.com/teachaid",
      "plans": {
        "student_month": {
          "usd": 6
        },
        "student_year": {
          "usd": 60
        },
        "institutional_pilot": {
          "usd": 2500,
          "per": "campus per semester",
          "max_students": 500,
          "onboarding": "included"
        }
      },
      "free": {
        "courses": 1,
        "answers": "text-only cited answers",
        "voice": false
      },
      "plain": "Student $6/month, $60/year. Free: 1 course, text-only cited answers, no voice. Institutional pilot $2,500 per campus per semester, up to 500 students, onboarding included."
    }
  },
  "suite": {
    "plain": "First 1 GB of input free, once per IP address (lifetime, no monthly reset), then $0.25 per GB of input. Customer-set monthly spend cap (default $25), alert at 80% of cap/allowance. Pro $25/month including 100 GB, then $0.20/GB. x402 per-call for agents; Stripe monthly for humans.",
    "free_cap_gb": 1,
    "window": "lifetime",
    "free_scope": "ip",
    "usd_per_gb_after_free": 0.25,
    "min_paid_usd": 1,
    "cap_default_usd": 25,
    "alert_at_pct": 80,
    "included_gb": {
      "unpaid": 1,
      "pcc-pro": 100,
      "psi-solo": 10,
      "psi-crew": 200,
      "psi-team": 200,
      "psi-lab-pass": 2000
    },
    "page": "https://www.slidphilabs.com/pcc"
  },
  "aliases": {
    "tru8": "pcc-pro-year",
    "tru8-year": "pcc-pro-year",
    "gate": "pcc-pro-year",
    "gate-year": "pcc-pro-year",
    "zrw": "pcc-pro-year",
    "trustream": "pcc-pro-year",
    "psi": "psi-crew",
    "persist": "psi-crew",
    "cddg": "consulting",
    "support-integration": "consulting",
    "slid-phi": "consulting",
    "chamber-week": "chamber-month",
    "chamber-day": "chamber-month",
    "lab-pass-year": "lab-pass",
    "fleetpulse": "rider-team",
    "fetchgate": "quikgater",
    "pulsar-closed": "pulsar-exception",
    "pulsar-embed": "pulsar-exception",
    "rider-bundle": "rider-team",
    "rider-crew": "rider-team",
    "rider-shop": "rider-fleet",
    "gc-month": "pcc-pro",
    "gc-year": "pcc-pro-year",
    "gc-day": "pcc-meter",
    "warrant-month": "warrant-addon",
    "warrant-year": "warrant-addon",
    "psi-month": "psi-embed-grant",
    "psi-year": "psi-embed-grant"
  },
  "disputed": {
    "note": "Unresolved price/wording conflicts. A disputed figure is NEVER canonical: do not present either side as the price, do not harmonize wording, do not edit the holding files. Resolution is the owner's call.",
    "teachaid": {
      "question": "TeachAid Pro $9/mo vs student $6/mo — same product or two tiers?",
      "values": {
        "pro_9_usd_per_month": 9,
        "student_6_usd_per_month": 6
      },
      "holding_files": {
        "pro_9": [
          "site/products.html:32",
          "site/humans.html:39",
          "site/pricing-usage.html:41",
          "site/llms-full.txt:21",
          "docs/agent-skills/teachaid-spu/SKILL.md:57"
        ],
        "student_6": [
          "docs/site/teachaid.html:7,27,51",
          "docs/site/pricing.json (math.teachaid_student)",
          "docs/site/llms.txt:85,151",
          "docs/site/api/lib/payments-rails.js:398,406"
        ]
      },
      "action": "No TeachAid price was changed anywhere."
    },
    "pcc_free_window": {
      "question": "Is the first 1 GB free once per IP for lifetime, or free each month?",
      "values": {
        "lifetime_once_per_ip": "first 1 GB free once per IP (lifetime, no monthly reset)",
        "monthly": "first 1 GB free each month / a month"
      },
      "holding_files": {
        "lifetime": [
          "docs/site/pricing.html:7,13,19,22,28,34,38,64",
          "docs/site/docs.html:38",
          "docs/site/llms.txt:35,72,124",
          "docs/site/api/lib/payments-rails.js (PCC usage blurb)",
          "docs/site/api/lib/mcp-catalogs.mjs:24"
        ],
        "monthly": [
          "docs/site/pcc.html:48,71",
          "docs/site/wiki/pcc.html:49",
          "docs/site/.well-known/agents.txt:3",
          "docs/site/.well-known/mcp/server-card.json (description)"
        ]
      },
      "action": "Free-window wording was not harmonized anywhere."
    },
    "tollkeeper_toll_5_exactness": {
      "question": "Toll 5 exactness check: $0.10 or $0.05 per check?",
      "values": {
        "usd_0_10": 0.1,
        "usd_0_05": 0.05
      },
      "holding_files": {
        "usd_0_10": [
          "docs/site/tollkeeper.html:88"
        ],
        "usd_0_05": [
          "docs/site/wiki/tollkeeper.html:53",
          "docs/site/llms.txt:56",
          "docs/site/index.html:166",
          "docs/site/tollkeeper.html:129 (ten-tool list: attest-exactness)"
        ]
      },
      "action": "No Tollkeeper figure was changed. Toll 5 is excluded from products.tollkeeper and from check-prices.mjs assertions."
    }
  }
}
;
export default PRICING;
