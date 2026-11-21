/** Silent-error rules for money, time, and crypto amounts. */
export function silentErrors(source) {
  const text = String(source || "");
  const findings = [];
  const money = /\b(usd|price|amount|balance|fee)\b/i.test(text);
  const floatLiteral = /\b\d+\.\d+\b/.test(text);
  const exactMoney = /\b(bigint|Decimal|cents)\b/.test(text);
  if (money && floatLiteral && !exactMoney) {
    findings.push({
      rule: "money-float",
      detail: "A money field uses a decimal literal without bigint, Decimal, or cents.",
    });
  }
  if (/\bnew Date\(/.test(text) && !/timeZone|toISOString|UTC/.test(text)) {
    findings.push({
      rule: "time-local",
      detail: "new Date() has no timezone or UTC conversion.",
    });
  }
  if (/\b(wei|lamports|satoshi|token_amount)\b/i.test(text) && floatLiteral) {
    findings.push({
      rule: "crypto-float",
      detail: "A crypto amount is written as a float.",
    });
  }
  return findings;
}
