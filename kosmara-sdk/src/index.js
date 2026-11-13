// Kosmara SDK: abre posiciones en Orca Whirlpools y lee las posiciones de una wallet.
// Se compila con Vite a ../sdk/kz-sdk.js y lo carga la web (020.html) como modulo.
// La web llama a window.kzSdk.openPosition(...) y window.kzSdk.positions(...).
import { openPositionInstructions, fetchPositionsForOwner } from "@orca-so/whirlpools";
import { fetchAllWhirlpool } from "@orca-so/whirlpools-client";
import {
  createSolanaRpc,
  address,
  createNoopSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  partiallySignTransactionMessageWithSigners,
  getTransactionEncoder,
} from "@solana/kit";

const COMPUTE_BUDGET = address("ComputeBudget111111111111111111111111111111");
const STABLES = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Instruccion del programa Compute Budget: etiqueta + entero little-endian.
function budgetIx(tag, value, bytes) {
  const data = new Uint8Array(1 + bytes);
  data[0] = tag;
  let v = BigInt(value);
  for (let i = 0; i < bytes; i++) {
    data[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return { programAddress: COMPUTE_BUDGET, accounts: [], data };
}

function toUnits(amount, decimals) {
  const n = Math.floor((+amount || 0) * Math.pow(10, decimals));
  return BigInt(n > 0 ? n : 0);
}

async function confirm(rpc, signature) {
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    let st = null;
    try {
      st = (await rpc.getSignatureStatuses([signature]).send()).value[0];
    } catch (e) {
      continue;
    }
    if (!st) continue;
    if (st.err) throw new Error("La red rechazó la transacción: " + JSON.stringify(st.err, (k, v) => (typeof v === "bigint" ? String(v) : v)));
    if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return true;
  }
  return false;
}

/**
 * Abre una posicion de liquidez concentrada en un pool de Orca.
 * El programa de Orca acuna el NFT de la posicion directamente en la wallet que firma.
 * o = { rpc, pool, owner, amountA, amountB, decA, decB, lower, upper, slipBps, provider }
 *   amountA / amountB: maximo de cada token a depositar, en unidades normales (no lamports)
 *   lower / upper: precios del rango (token B por token A)
 *   provider: window.phantom.solana (firma y envia)
 */
async function openPosition(o) {
  if (!o || !o.provider || !o.owner) throw new Error("Conecta tu wallet primero");
  const V = window.solanaWeb3 && window.solanaWeb3.VersionedTransaction;
  if (!V) throw new Error("No se cargó la librería de Solana");
  const tokenMaxA = toUnits(o.amountA, o.decA);
  const tokenMaxB = toUnits(o.amountB, o.decB);
  if (tokenMaxA <= 0n && tokenMaxB <= 0n) throw new Error("Introduce una cantidad");
  if (!(o.lower > 0) || !(o.upper > o.lower)) throw new Error("Rango de precios no válido");

  const rpc = createSolanaRpc(o.rpc);
  const funder = createNoopSigner(address(o.owner));
  const res = await openPositionInstructions(rpc, address(o.pool), { tokenMaxA, tokenMaxB }, o.lower, o.upper, {
    slippageToleranceBps: Math.max(1, Math.round(o.slipBps || 100)),
    funder,
  });

  const instructions = [budgetIx(2, 600000, 4), budgetIx(3, 50000, 8)].concat(res.instructions);
  const blockhash = (await rpc.getLatestBlockhash().send()).value;
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(funder, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  // Firma con las claves temporales que genera el SDK (el mint del NFT); la wallet firma despues.
  const partial = await partiallySignTransactionMessageWithSigners(message);
  const bytes = new Uint8Array(getTransactionEncoder().encode(partial));

  const sent = await o.provider.signAndSendTransaction(V.deserialize(bytes));
  const signature = (sent && sent.signature) || String(sent);
  const confirmed = await confirm(rpc, signature);
  return {
    signature,
    confirmed,
    positionMint: String(res.positionMint),
    initializationCost: Number(res.initializationCost) / 1e9,
  };
}

async function poolMeta(addr) {
  try {
    const r = await fetch("https://api.orca.so/v2/solana/pools/" + addr);
    if (!r.ok) return null;
    const j = await r.json();
    const d = j && j.data ? j.data : j;
    return Array.isArray(d) ? d[0] : d;
  } catch (e) {
    return null;
  }
}

function short(a) {
  a = String(a);
  return a.slice(0, 4) + "…" + a.slice(-4);
}

/**
 * Lee las posiciones de Orca de una wallet y las devuelve listas para pintar.
 * o = { rpc, owner }
 */
async function positions(o) {
  const rpc = createSolanaRpc(o.rpc);
  const found = await fetchPositionsForOwner(rpc, address(o.owner));
  const list = [];
  found.forEach((x) => {
    if (x.isPositionBundle) (x.positions || []).forEach((p) => list.push(p));
    else list.push(x);
  });
  if (!list.length) return [];

  const poolAddrs = Array.from(new Set(list.map((p) => String(p.data.whirlpool))));
  const pools = await fetchAllWhirlpool(rpc, poolAddrs.map((a) => address(a)));
  const P = {};
  pools.forEach((w) => (P[String(w.address)] = w.data));

  const mints = Array.from(new Set(pools.flatMap((w) => [String(w.data.tokenMintA), String(w.data.tokenMintB)])));
  const DEC = {};
  const accs = (await rpc.getMultipleAccounts(mints.map((m) => address(m)), { encoding: "jsonParsed" }).send()).value;
  mints.forEach((m, i) => {
    const info = accs[i] && accs[i].data && accs[i].data.parsed && accs[i].data.parsed.info;
    DEC[m] = info ? Number(info.decimals) : 6;
  });

  const META = {};
  await Promise.all(poolAddrs.map(async (a) => (META[a] = await poolMeta(a))));

  return list
    .map((p) => {
      const d = p.data;
      const w = P[String(d.whirlpool)];
      if (!w) return null;
      const mA = String(w.tokenMintA);
      const mB = String(w.tokenMintB);
      const dA = DEC[mA];
      const dB = DEC[mB];
      const meta = META[String(d.whirlpool)] || {};
      const tA = meta.tokenA || {};
      const tB = meta.tokenB || {};
      const symA = tA.symbol || STABLES[mA] || short(mA);
      const symB = tB.symbol || STABLES[mB] || short(mB);

      const scale = Math.pow(10, dA - dB);
      const sp = Number(w.sqrtPrice) / 18446744073709551616; // Q64.64
      const sa = Math.pow(1.0001, d.tickLowerIndex / 2);
      const sb = Math.pow(1.0001, d.tickUpperIndex / 2);
      const L = Number(d.liquidity);
      let rawA = 0;
      let rawB = 0;
      if (sp <= sa) rawA = L * (1 / sa - 1 / sb);
      else if (sp >= sb) rawB = L * (sb - sa);
      else {
        rawA = L * (1 / sp - 1 / sb);
        rawB = L * (sp - sa);
      }
      const amtA = rawA / Math.pow(10, dA);
      const amtB = rawB / Math.pow(10, dB);
      const price = sp * sp * scale;

      // Valor en dolares: solo cuando el token B es un dolar estable (USDC/USDT).
      const usd = STABLES[mB] ? amtA * price + amtB : STABLES[mA] && price > 0 ? amtA + amtB / price : null;

      return {
        pair: symA + "/" + symB,
        fee: w.feeRate != null ? String(Number(w.feeRate) / 10000) : "",
        price,
        lo: sa * sa * scale,
        hi: sb * sb * scale,
        usd,
        amtA,
        amtB,
        symA,
        symB,
        pnl: null,
        harv: null,
        pend: null,
        dur: "—",
        mint: String(d.positionMint),
        pool: String(d.whirlpool),
      };
    })
    .filter(Boolean);
}

window.kzSdk = { ready: true, version: "0.1.0", openPosition, positions };
window.dispatchEvent(new Event("kzsdk"));
