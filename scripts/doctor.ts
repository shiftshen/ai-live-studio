import { existsSync, readFileSync } from "node:fs";
const token = existsSync("var/admin-token")
  ? readFileSync("var/admin-token", "utf8").trim()
  : "";
try {
  const r = await fetch("http://127.0.0.1:8890/api/v1/diagnostics", {
    headers: { authorization: "Bearer " + token },
    signal: AbortSignal.timeout(5000),
  });
  console.log(JSON.stringify(await r.json(), null, 2));
} catch {
  console.log("服务未启动；运行 npm run up");
  process.exitCode = 1;
}
