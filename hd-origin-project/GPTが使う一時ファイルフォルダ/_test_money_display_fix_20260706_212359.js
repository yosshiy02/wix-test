function money(value) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }
  const original = String(value).trim();
  if (original === "") {
    return "0";
  }
  const raw = original.replace(/,/g, "");
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const n = Number(raw);
    return Number.isFinite(n)
      ? n.toLocaleString("ja-JP", { maximumFractionDigits: 20 })
      : original;
  }
  const sign = match[1] || "";
  const integerPart = match[2] || "0";
  const decimalPart = match[3];
  let integerText = Number(sign + integerPart).toLocaleString("ja-JP");
  if (!decimalPart || /^0+$/.test(decimalPart)) {
    return integerText;
  }
  return integerText + "." + decimalPart;
}
const tests = [
  ["68200.00", "68,200"],
  ["5500.00", "5,500"],
  ["0.00", "0"],
  ["123.45", "123.45"],
  ["123.40", "123.40"],
  ["0.50", "0.50"],
  ["126500.00", "126,500"],
  ["-12345.00", "-12,345"]
];
const result = tests.map(([input, expected]) => {
  const actual = money(input);
  return { input, expected, actual, ok: actual === expected };
});
const allOk = result.every(x => x.ok);
console.log(JSON.stringify({ allOk, result }, null, 2));
if (!allOk) {
  process.exit(1);
}