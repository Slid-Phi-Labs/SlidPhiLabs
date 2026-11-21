# DRAFT — NOT FILED. Needs an attorney before any filing.

Title: Keeping a result only when every compared output is the same and the
decoded bytes match the input.

What the code does today: exactness-gate keeps a set of stdout strings when
they match and refuses the set when one differs. The warrant path refuses a
result that fails its own checks for host, action, expiry, revocation, calls,
or dollars.

## Steps the code already takes

All stdout strings equal means keep the set.
One different stdout means refuse the whole set.

This draft does not include claims, drawings, or an inventor oath.
The method is not claimed to be the smallest compressor.
