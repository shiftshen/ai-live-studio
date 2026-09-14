import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const token = readFileSync("var/admin-token", "utf8").trim();
const headers = {
  authorization: "Bearer " + token,
  "content-type": "application/json",
};
const report: any = {
  startedAt: new Date().toISOString(),
  jobs: [],
  physicalPaperObserved: false,
};
for (const [language, text] of [
  [
    "zh",
    "AI Live Studio 接入验收\n你好，直播间！\n飞鹅测试机6218\n仅测试，不是餐厅订单。",
  ],
  ["th", "AI Live Studio\nสวัสดี ขอบคุณที่รับชม\nทดสอบเครื่องพิมพ์"],
  [
    "en",
    "AI Live Studio\nHello, thank you for joining!\nPrinter integration test.",
  ],
]) {
  const r = await fetch(
    "http://127.0.0.1:8890/api/v1/printers/feie-test/test",
    { method: "POST", headers, body: JSON.stringify({ language, text }) },
  );
  const j: any = await r.json();
  report.jobs.push({ id: j.id, language, status: j.status, error: j.error });
}
mkdirSync("var/evidence", { recursive: true });
writeFileSync(
  "var/evidence/physical-test.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
