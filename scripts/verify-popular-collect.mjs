function normalizeWorkCode(value) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000-]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractProductCode(contentId) {
  const normalized = contentId.trim().toLowerCase();
  const withoutPrefix = normalized.replace(/^[a-z0-9]+_/, "");
  return normalizeWorkCode(withoutPrefix || normalized);
}

const cases = [
  ["START-00319", "start00319", "START00319"],
];

for (const group of cases) {
  const normalized = new Set(group.map((v) => normalizeWorkCode(v)));
  console.log(
    `${normalized.size === 1 ? "OK" : "NG"} identity: ${group.join(" = ")}`,
  );
}

console.log(`product code: ${extractProductCode("h_491start00319")}`);

for (const [label, pages, total] of [
  ["10", [10], 10],
  ["50", [50], 50],
  ["200", [100, 100], 200],
  ["500", [100, 100, 100, 100, 100], 500],
]) {
  const sum = pages.reduce((a, b) => a + b, 0);
  console.log(
    `${sum === total ? "OK" : "NG"} fetch ${label}: [${pages.join(",")}] = ${sum}`,
  );
}
