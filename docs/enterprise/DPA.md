# Data Processing Addendum — Slid Phi Labs (template v1)

> Draft for procurement review. Have counsel review before countersigning.
> Contact: corey@slidphilabs.com.

**Processor:** Slid Phi Labs, Cherry Hill, New Jersey ("Lab").
**Controller:** [Customer legal name] ("Customer").
This DPA forms part of the enterprise or annual agreement between Lab and
Customer (the "Agreement").

## 1. Subject matter and duration
Processing of Customer Data to provide the Lab's hosted products
(compression jobs, agent identity, mandates, receipts), for the term of the
Agreement plus 30 days for return-or-delete.

## 2. Nature, purpose, and data types
Seat identifiers, contact and billing details, usage logs, and the
receipts/ledgers Customer workflows create. No special-category data is
solicited; Customer agrees not to submit any.

## 3. Processor obligations
Process only on documented Customer instructions; ensure personnel
confidentiality; assist with data-subject requests within 10 business days;
delete or return Customer Data within 30 days of termination (backups age
out within 90 days); make available an annual security questionnaire response.

## 4. Subprocessors
Fly.io (hosting), Supabase (optional seat store), XPay on Base (USDC
settlement), Stripe (subscriptions). Lab gives 14 days' notice of any change;
Customer may object with cause and terminate the affected order for refund
of prepaid, unused fees.

## 5. Security measures
ES256-signed credentials with 15-minute to 24-hour lifetimes, hash-only API
key storage, published JWKS with revocation list, fail-closed verification,
and append-only audit ledgers, as described at
https://www.slidphilabs.com/security.

## 6. Breach notification
Without undue delay and within 72 hours of confirmation: nature, categories
and approximate volume of data, likely consequences, and mitigation taken.

## 7. Audits
Once per 12 months, on 30 days' notice, Customer (or its qualified auditor
under NDA) may audit compliance during business hours, at Customer's cost,
not to exceed 2 business days and without disrupting other tenants.

## 8. International transfers
Where Customer Data leaves Customer's jurisdiction, the parties adopt the
applicable standard contractual clauses, with this DPA as the mandate.

## 9. Liability and precedence
Liability caps in the Agreement apply. On conflict between the Agreement
and this DPA on data-protection matters, this DPA prevails.

Agreed: ______________________ (Lab, date) / ______________________ (Customer, date)
