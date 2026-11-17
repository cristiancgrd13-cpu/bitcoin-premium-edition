/*
 * Puente seguro para la API DEX de OKX (Cloudflare Worker).
 * OKX exige firmar cada petición con una clave secreta: esa clave NO puede ir en la web pública.
 * Este worker guarda las claves como "secrets" de Cloudflare, firma la petición y añade
 * siempre la comisión de Kosmara (no se puede quitar desde el navegador).
 *
 * Secrets que hay que crear en Cloudflare (Settings → Variables and Secrets):
 *   OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE   → del portal de desarrolladores de OKX
 *   FEE_EVM_ADDRESS   → tu wallet de Ethereum donde cobrar en redes EVM
 *   FEE_SOL_ADDRESS   → tu wallet de Solana donde cobrar en Solana
 *   FEE_PERCENT       → comisión en %, p. ej. "0.3" (máx. 3 en EVM y 10 en Solana)
 *   ALLOWED_ORIGIN    → p. ej. "https://cristiancgrd13-cpu.github.io"
 */
const OKX = "https://web3.okx.com";
const ALLOWED = ["/api/v6/dex/aggregator/quote", "/api/v6/dex/aggregator/swap", "/api/v6/dex/aggregator/approve-transaction",
  "/api/v6/dex/aggregator/all-tokens", "/api/v6/dex/aggregator/supported/chain"];
const SOL_CHAIN = "501";

async function sign(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(s)));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return new Response("Origen no permitido", { status: 403, headers: cors });
    if (req.method !== "GET") return new Response("Solo GET", { status: 405, headers: cors });

    const u = new URL(req.url);
    if (!ALLOWED.includes(u.pathname)) return new Response("Ruta no permitida", { status: 404, headers: cors });

    // La comisión de Kosmara se fija aquí, en el servidor.
    if (u.pathname.endsWith("/swap") || u.pathname.endsWith("/quote")) {
      const sol = u.searchParams.get("chainIndex") === SOL_CHAIN || u.searchParams.get("chainId") === SOL_CHAIN;
      const rcv = sol ? env.FEE_SOL_ADDRESS : env.FEE_EVM_ADDRESS;
      ["feePercent", "fromTokenReferrerWalletAddress", "toTokenReferrerWalletAddress"].forEach(p => u.searchParams.delete(p));
      if (rcv && +env.FEE_PERCENT > 0) {
        u.searchParams.set("feePercent", String(Math.min(+env.FEE_PERCENT, sol ? 10 : 3)));
        if (u.pathname.endsWith("/swap")) u.searchParams.set("fromTokenReferrerWalletAddress", rcv);
      }
    }

    const path = u.pathname + (u.search || "");
    const ts = new Date().toISOString();
    const r = await fetch(OKX + path, {
      headers: {
        "OK-ACCESS-KEY": env.OKX_API_KEY,
        "OK-ACCESS-SIGN": await sign(env.OKX_SECRET_KEY, ts + "GET" + path),
        "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": env.OKX_PASSPHRASE,
      },
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
  },
};
