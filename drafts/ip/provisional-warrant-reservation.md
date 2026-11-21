# DRAFT — NOT FILED. Needs an attorney before any filing.

Title: Holding a spend amount before an agent job and returning it if the job does not run.

What the code does today: a warrant token names a dollar cap and a call cap.
A reserve deducts the expected cost. The same idempotency key returns that
reserve instead of deducting again. A receipt consumes one call. A release
returns an unused reserve. Two processes cannot both take the same dollars.

## Steps the code already takes

Reserve deducts the expected dollars before the job runs.
The same idempotency key returns the same reservation.
A receipt consumes one call.
A release refunds the unused reserve.

This draft does not include claims, drawings, or an inventor oath.
