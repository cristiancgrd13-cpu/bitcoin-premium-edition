import {PublicKey} from "@solana/web3.js";
const RPC="https://solana-rpc.publicnode.com",PROG=new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const POOL=process.argv[2]||"Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
async function rc(m,p){const r=await fetch(RPC,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://cristiancgrd13-cpu.github.io"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})});console.log("http",r.status,r.headers.get("access-control-allow-origin"));const j=await r.json();if(j.error)throw new Error(JSON.stringify(j.error));return j.result}
const u128=(b,o)=>{let v=0n;for(let i=15;i>=0;i--)v=(v<<8n)|BigInt(b[o+i]);return v};
const i128=(b,o)=>{let v=u128(b,o);return v>=(1n<<127n)?v-(1n<<128n):v};
const a=await rc("getAccountInfo",[POOL,{encoding:"base64"}]);const w=Buffer.from(a.value.data[0],"base64");
const ts=w.readUInt16LE(41),L=u128(w,49),cur=w.readInt32LE(81);console.log({len:w.length,ts,L:L.toString(),cur});
const span=88*ts,s0=Math.floor(cur/span)*span,starts=[];for(let k=-3;k<=3;k++)starts.push(s0+k*span);
const pdas=starts.map(s=>PublicKey.findProgramAddressSync([Buffer.from("tick_array"),new PublicKey(POOL).toBuffer(),Buffer.from(String(s))],PROG)[0].toBase58());
const t0=Date.now();const r=await rc("getMultipleAccounts",[pdas,{encoding:"base64"}]);console.log("ms",Date.now()-t0);
const ticks=[];r.value.forEach((x,i)=>{if(!x){console.log("missing",starts[i]);return}const b=Buffer.from(x.data[0],"base64");if(i===0)console.log("talen",b.length,"start",b.readInt32LE(8));
 for(let j=0;j<88;j++){const o=12+j*113;if(b[o])ticks.push([b.readInt32LE(8)+j*ts,i128(b,o+1)])}});
console.log("init ticks",ticks.length,ticks.slice(0,3).map(t=>[t[0],t[1].toString()]));
