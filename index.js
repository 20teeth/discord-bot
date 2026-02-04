const HEARTBEAT_URL = process.env.HEALTHCHECKS_URL || ""; // set with `pm2 set pm2:20t-bot:HEALTHCHECKS_URL`
const HEARTBEAT_EVERY_MS = Number(process.env.HEALTHCHECKS_INTERVAL_MS || 300000); // 5 min

if (HEARTBEAT_URL) {
  const ping = async () => {
    try {
      const res = await fetch(HEARTBEAT_URL, { method: "GET" });
      if (!res.ok) console.warn("[heartbeat] ping failed:", res.status);
      else console.log("[heartbeat] ok");
    } catch (e) {
      console.warn("[heartbeat] error:", e?.message || e);
    }
  };

  ping();
  setInterval(ping, HEARTBEAT_EVERY_MS).unref();
}

require("./src/index");
