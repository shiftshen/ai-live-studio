import { Store } from "../src/server/store.ts";
import { Secrets, feieCall } from "../src/server/providers.ts";
const s = new Store("var/studio.sqlite3");
const keys = new Secrets("var/secrets");
const selectedSn = process.env.DAMO_PRINTER_SN ?? keys.get("feie-test")?.sn;
if (!selectedSn)
  throw Error("请通过 DAMO_PRINTER_SN 指定目标设备，不自动选择门店打印机");
if (!keys.importDamo(selectedSn)) throw Error("安全测试机配置未找到");
const secret = keys.get("feie-test")!;
const status = await feieCall(secret, "Open_queryPrinterStatus");
s.put("printers", {
  id: "feie-test",
  name: "飞鹅测试机 · " + secret.sn.slice(-4),
  renderLanguage: "Thai",
  snLast4: secret.sn.slice(-4),
  configured: true,
  status: String(status),
  imageSupported: false,
  paperWidth: 58,
  enabled: true,
  lastChecked: Date.now(),
  error: null,
});
console.log(
  JSON.stringify({
    configured: true,
    snLast4: secret.sn.slice(-4),
    status,
    avatar: "unverified",
  }),
);
s.close();
