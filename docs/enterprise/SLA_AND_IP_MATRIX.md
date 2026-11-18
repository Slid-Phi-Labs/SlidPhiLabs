# Support tiers, SLAs, and IP/licensing matrix (v1 proposal)

> Commercial terms below are the Lab's opening proposal — confirmed at
> signature on an enterprise order. Self-serve behavior is as documented on
> https://www.slidphilabs.com/pricing-usage and /status.

## Support tiers and SLAs

| Tier | Uptime target | Incident response | Channel | Price basis |
|---|---|---|---|---|
| Self-serve | Best-effort, none claimed | Human reply, no window promised | corey@slidphilabs.com | Metered usage (see /pricing-usage) |
| Business (annual) | 99.5% monthly, hosted APIs | 1 business day | Email, named thread | Annual agreement |
| Enterprise | 99.9% monthly, hosted APIs | 4 clock hours, sev-1 escalation path | Email + paging contact | Scoped order |

Exclusions: customer network, customer keys/secrets handling, upstream
processor outages (credited only if the processor credits us), scheduled
maintenance with 72h notice. Service credits: 10% of monthly fees per
1-point miss below target, capped at 50%.

## IP and licensing matrix

| Asset | License | Commercial use | Hosted/gated | IP indemnity |
|---|---|---|---|---|
| Site and docs | AGPL-3.0-or-later OR commercial | Under commercial grant | n/a | In commercial agreements |
| shard-zip | GPL-3.0-only | Per GPL terms; closed use needs grant | n/a | In commercial agreements |
| slid-phi (npm) | Per repo LICENSE | Per repo LICENSE | n/a | In commercial agreements |
| spl-pay-per-suite (npm) | Per repo LICENSE | Per repo LICENSE | n/a | In commercial agreements |
| Chamber (hosted) | Commercial | Paid tiers | Gated, metered | In commercial agreements |
| Agent-Rider (hosted) | Commercial | Paid tiers | Gated, clearance L0–L4 | In commercial agreements |
| Warrant / PERsiST integrations | Per repo LICENSE | Per repo LICENSE | Gated where hosted | In commercial agreements |

Closed use — running Lab software without sharing changes — needs a
commercial grant (see /license). Open-source boundaries are stated in each
repo; nothing closed is silently metered and nothing open is silently gated.
