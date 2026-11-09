import "./style.css";
import { setWhirlpoolsConfig, openPositionInstructions } from "@orca-so/whirlpools";
import { createSolanaRpc, address, createNoopSigner, pipe, createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, partiallySignTransactionMessageWithSigners, getTransactionEncoder, getBase64Decoder, getBase58Decoder } from "@solana/kit";
import { getWallets } from "@wallet-standard/app";


function $(i){return document.getElementById(i)}
function f(n,d){return n.toLocaleString("es-ES",{maximumFractionDigits:d==null?2:d})}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function toast(t){var e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){e.hidden=true},4200)}
function LS(k,v){try{if(v===undefined)return localStorage.getItem(k)||"";localStorage.setItem(k,v)}catch(e){return ""}}
function fp(n){return !isFinite(n)?"—":n>=1?f(n,n>=100?2:4):f(n,6)}
function short(a){return a&&a.length>12?a.slice(0,5)+"…"+a.slice(-4):a||""}
var S={key:LS("kz_jup"),rpc:LS("kz_rpc"),pk:"",wname:"",bal:{},pools:{},stat:{},flt:"all",q:"",sort:"tvl",lim:40,sel:"",rows:[],net:"",addr:""},CSV="";
function rpcUrl(){return S.rpc||"https://api.mainnet-beta.solana.com"}
async function rc(m,p){var r=await fetch(rpcUrl(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})});if(!r.ok)throw new Error("RPC HTTP "+r.status);var j=await r.json();if(j.error)throw new Error(j.error.message);return j.result}
function b64u(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function u8b(u){var s="";for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)}

/* ---------- Jupiter (swap real) ---------- */
var JB="https://api.jup.ag/swap/",LBL=null;
async function jj(u,body){
 var o={headers:{"x-api-key":S.key}};if(body){o.method="POST";o.headers["Content-Type"]="application/json";o.body=JSON.stringify(body)}
 var r=await fetch(JB+u,o),t=await r.text(),j=null;try{j=JSON.parse(t)}catch(e){}
 if(!r.ok||(j&&j.error))throw new Error((j&&(j.error||j.message))||"Jupiter HTTP "+r.status);return j}
async function labels(){if(LBL)return LBL;var m=await jj("v1/program-id-to-label"),a=[];for(var k in m)if(a.indexOf(m[k])<0)a.push(m[k]);LBL=a;return a}
async function dexFor(v){var re={Orca:/orca|whirlpool/i,Raydium:/raydium/i,Meteora:/meteora/i}[v],d=(await labels()).filter(function(l){return re.test(l)}).join(",");if(!d)throw new Error("Jupiter no lista "+v);return d}
async function quoteV(v,im,om,amt,slip){
 if(!S.key)throw new Error("Falta la clave de Jupiter");
 if(v==="Jupiter"){var o=await jj("v2/order?inputMint="+im+"&outputMint="+om+"&amount="+amt);return{out:+o.outAmount}}
 var q=await jj("v1/quote?inputMint="+im+"&outputMint="+om+"&amount="+amt+"&slippageBps="+Math.round(slip*100)+"&dexes="+encodeURIComponent(await dexFor(v)));return{out:+q.outAmount}
}
/* ---------- Firma con Wallet Standard (Phantom y otras wallets de Solana) ---------- */
var WAL=null,ACC=null;
function rpcK(){return createSolanaRpc(rpcUrl())}
async function signBytes(bytes){var o=await WAL.features["solana:signTransaction"].signTransaction({account:ACC,transaction:bytes,chain:"solana:mainnet"});return o[0].signedTransaction}
async function sendBytes(bytes){
 var fs=WAL.features["solana:signAndSendTransaction"];
 if(fs){var o=await fs.signAndSendTransaction({account:ACC,transaction:bytes,chain:"solana:mainnet"});return getBase58Decoder().decode(o[0].signature)}
 var sg=await signBytes(bytes);return await rpcK().sendTransaction(getBase64Decoder().decode(sg),{encoding:"base64"}).send()
}
async function confirmSig(sig){
 for(var i=0;i<40;i++){var r=await rpcK().getSignatureStatuses([sig]).send(),s=r.value[0];
  if(s){if(s.err)throw new Error("La transacción falló en la red");if(s.confirmationStatus==="confirmed"||s.confirmationStatus==="finalized")return}
  await new Promise(function(z){setTimeout(z,1500)})}
 throw new Error("No se confirmó a tiempo; revísala en Solscan.")
}
async function execSwap(v,im,om,amt,slip){
 if(!WAL||!S.pk)throw new Error("Conecta tu wallet primero");
 if(v==="Jupiter"){
  var o=await jj("v2/order?inputMint="+im+"&outputMint="+om+"&amount="+amt+"&taker="+S.pk);if(!o.transaction)throw new Error("Jupiter no devolvió transacción");
  var sg=await signBytes(b64u(o.transaction)),ex=await jj("v2/execute",{signedTransaction:u8b(sg),requestId:o.requestId});
  if(ex.status&&ex.status!=="Success")throw new Error(ex.error||ex.status);return ex.signature||""}
 var q=await jj("v1/quote?inputMint="+im+"&outputMint="+om+"&amount="+amt+"&slippageBps="+Math.round(slip*100)+"&dexes="+encodeURIComponent(await dexFor(v)));
 var s=await jj("v1/swap",{quoteResponse:q,userPublicKey:S.pk,dynamicComputeUnitLimit:true});return await sendBytes(b64u(s.swapTransaction))
}

/* ---------- Swap ---------- */
var SOLM="So11111111111111111111111111111111111111112",VEN=["Jupiter","Orca","Raydium","Meteora"];
var TKS=[["SOL",SOLM,9],["USDC","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",6],["JUP","JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",6],["ORCA","orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",6],["RAY","4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",6]].map(function(a){return{s:a[0],m:a[1],d:a[2]}}),TM={};
TKS.forEach(function(t){TM[t.s]=t});
var SW={from:"SOL",to:"USDC",amt:"",slip:1,res:[],sel:""};
function sres(h){var e=$("sres");if(e)e.innerHTML=h}
function sopts(v){return TKS.map(function(t){return "<option"+(t.s===v?" selected":"")+">"+t.s+"</option>"}).join("")}
function rSwap(){
 var fr=TM[SW.from],bal=S.bal[fr.m];
 $("swap").innerHTML='<div class="k">Swap en Solana <small>rutas reales vía Jupiter</small></div>'+
 '<div class="box"><label for="amt">Das · saldo '+(S.pk?f(bal||0,6)+" "+fr.s:"conecta Phantom")+'</label><div class="srow"><select id="sf">'+sopts(SW.from)+'</select><input id="amt" class="num" type="number" inputmode="decimal" min="0" step="any" value="'+esc(SW.amt)+'" placeholder="0.0"></div>'+
 '<div class="chips"><button class="btn" data-pct="25">25%</button><button class="btn" data-pct="50">50%</button><button class="btn" data-pct="100">Máx</button><button class="btn" data-act="flip">⇅</button></div></div>'+
 '<div class="box" style="margin-top:8px"><label for="st">Recibes</label><div class="srow"><select id="st">'+sopts(SW.to)+'</select><span class="dim">estimado en las rutas</span></div></div>'+
 '<div class="hrow"><span class="dim">Deslizamiento máx. <select id="sw-slip">'+[.5,1,3].map(function(v){return '<option value="'+v+'"'+(v===SW.slip?" selected":"")+">"+v+"%</option>"}).join("")+'</select></span></div>'+
 '<button class="btn p" style="background:rgba(255,255,255,.1);color:#fff" data-act="quote">Buscar mejores precios</button><div id="qt"></div>'+
 '<button class="btn p" data-act="doswap">Swap (real)</button><div class="stat" id="sres"></div><div class="dim" style="margin-top:6px">DFlow, JupiterZ y otros routers compiten dentro de la opción Jupiter (mejor ruta).</div>';
 rQt();
}
function rQt(){
 var el=$("qt");if(!el)return;var to=TM[SW.to];
 el.innerHTML=SW.res.map(function(r,i){return r.err?'<div class="row"><div><b>'+r.v+'</b><small class="dn">'+esc(r.err)+"</small></div></div>":'<div class="row pick'+(r.v===SW.sel?" sel":"")+'" data-rt="'+r.v+'"><div><b>'+r.v+"</b>"+(r.best?'<span class="tag">MEJOR</span>':'')+'<small>'+(r.v==="Jupiter"?"mejor ruta (todos los routers)":"solo "+r.v)+'</small></div><div class="v"><b>'+f(r.out,6)+" "+to.s+'</b><small class="'+(r.best?"up":"dn")+'">'+(r.best?"mejor precio":f(r.diff,2)+"%")+'</small></div></div>'}).join("");
}
async function quoteAll(){
 var a=parseFloat(SW.amt),fr=TM[SW.from],to=TM[SW.to];
 if(!(a>0)||fr===to)return sres("Elige dos activos distintos e introduce una cantidad.");
 if(!S.key)return sres("Falta la clave de Jupiter: pégala en el bloque Conexiones.");
 var amt=Math.floor(a*Math.pow(10,fr.d));sres("Consultando rutas…");
 var R=await Promise.all(VEN.map(function(v){return quoteV(v,fr.m,to.m,amt,SW.slip).then(function(q){return{v:v,out:q.out/Math.pow(10,to.d)}},function(e){return{v:v,err:e.message}})}));
 var ok=R.filter(function(r){return !r.err}).sort(function(x,y){return y.out-x.out}),bad=R.filter(function(r){return r.err});
 ok.forEach(function(r,i){r.best=i===0;r.diff=ok[0].out?(r.out/ok[0].out-1)*100:0});
 SW.res=ok.concat(bad);SW.sel=ok.length?ok[0].v:"";rQt();sres(ok.length?"Elige una ruta y pulsa Swap.":"Ninguna ruta disponible.");
}
async function doSwap(){
 var a=parseFloat(SW.amt),fr=TM[SW.from],to=TM[SW.to],r=SW.res.filter(function(x){return x.v===SW.sel&&!x.err})[0];
 if(!S.pk)return toast("Conecta Phantom primero.");if(!r)return sres("Primero busca las mejores rutas.");
 if(!confirm("Vas a firmar un swap REAL:\n"+f(a,6)+" "+fr.s+" por unos "+f(r.out,6)+" "+to.s+" vía "+r.v+".\nRevisa los detalles en Phantom antes de aprobar."))return;
 try{sres("Esperando tu firma en Phantom…");var sg=await execSwap(r.v,fr.m,to.m,Math.floor(a*Math.pow(10,fr.d)),SW.slip);
  sres('Swap enviado. <a class="lk" href="https://solscan.io/tx/'+esc(sg)+'" target="_blank" rel="noopener">Ver en Solscan ↗</a>');SW.amt="";SW.res=[];loadBal().then(rSwap)}
 catch(e){sres("No se pudo completar: "+esc(e.message))}
}

/* ---------- Conexiones ---------- */
function rCfg(){
 $("cfg").innerHTML='<div class="k">Conexiones <small>se guardan solo en este navegador</small></div>'+
 '<label for="jk">Clave de API de Jupiter (gratis en <a class="lk" href="https://developers.jup.ag/portal" target="_blank" rel="noopener">developers.jup.ag/portal</a>)</label><input id="jk" type="password" autocomplete="off" value="'+esc(S.key)+'" placeholder="Pega tu clave">'+
 '<label for="rp">RPC de Solana (opcional; con uno propio, p. ej. Helius, va más fino que el público)</label><input id="rp" type="url" autocomplete="off" value="'+esc(S.rpc)+'" placeholder="https://api.mainnet-beta.solana.com">';
}

/* ---------- Pools reales ---------- */
function sy(s){return s==="WSOL"?"SOL":s}
function tk(t){t=t||{};return{m:t.address||t.mint||t.id||"",s:sy(t.symbol||t.name||"?"),d:t.decimals!=null?+t.decimals:9}}
function nm(x){x=+x;return isFinite(x)?x:null}
function mk(pr,id,A,B,p,tvl,vol,apr,fee,url){return{k:pr+":"+id,pr:pr,id:id,A:A,B:B,p:+p,tvl:+tvl||0,vol:+vol||0,apr:nm(apr),fee:nm(fee),url:url}}
var SRC={
 Orca:{u:function(q){return "https://api.orca.so/v2/solana/pools"+(q?"/search?q="+encodeURIComponent(q)+"&limit=50":"?limit=100&sortBy=tvl&sortDirection=desc&minTvl=20000")},
  r:function(j){return j.data||[]},
  n:function(p){var st=(p.stats&&(p.stats["24h"]||p.stats["1d"]))||{},y=st.yieldOverTvl!=null?st.yieldOverTvl:p.yieldOverTvl;return mk("Orca",p.address,tk(p.tokenA),tk(p.tokenB),p.price,p.tvlUsdc!=null?p.tvlUsdc:p.tvl,st.volume!=null?st.volume:p.volume24h,y!=null?y*36500:null,p.feeRate!=null?p.feeRate/1e4:null,"https://www.orca.so/pools/"+p.address)}},
 Raydium:{u:function(q){return q?null:"https://api-v3.raydium.io/pools/info/list?poolType=concentrated&poolSortField=tvl&sortType=desc&pageSize=100&page=1"},
  r:function(j){return (j.data&&j.data.data)||j.data||[]},
  n:function(p){var d=p.day||{};return mk("Raydium",p.id,tk(p.mintA),tk(p.mintB),p.price,p.tvl,d.volume,d.apr,p.feeRate!=null?p.feeRate*100:null,"https://raydium.io/clmm/create-position/?pool_id="+p.id)}},
 Meteora:{u:function(q){return "https://dlmm.datapi.meteora.ag/pools?page=1&page_size="+(q?50:100)+"&sort_by=tvl:desc"+(q?"&query="+encodeURIComponent(q):"")},
  r:function(j){return j.data||[]},
  n:function(p){var v=p.volume,vol=v&&typeof v==="object"?(v["24h"]!=null?v["24h"]:v.h24):v,a=p.apr;if(a&&typeof a==="object")a=a["24h"]!=null?a["24h"]:a.h24;
   if(a==null){var fr=p.fee_tvl_ratio;fr=fr&&typeof fr==="object"?(fr["24h"]!=null?fr["24h"]:fr.h24):fr;if(fr!=null)a=fr*365}
   var fee=p.pool_config&&p.pool_config.base_fee_pct!=null?p.pool_config.base_fee_pct:p.base_fee_pct;
   return mk("Meteora",p.address,tk(p.token_x),tk(p.token_y),p.current_price!=null?p.current_price:p.price,p.tvl,vol,a,fee,"https://app.meteora.ag/dlmm/"+p.address)}}
};
async function loadPools(q){
 await Promise.all(Object.keys(SRC).map(async function(n){
  var s=SRC[n],u=s.u(q);if(!u)return;
  try{var r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);var L=s.r(await r.json()),c=0;
   L.forEach(function(p){try{var o=s.n(p);if(o.id&&o.A.m&&o.B.m){S.pools[o.k]=o;c++}}catch(e){}});S.stat[n]=c+" pools"}
  catch(e){S.stat[n]="error: "+(e.message||"red")}}));
 rPools();
}
function filt(){
 var q=S.q.toLowerCase().trim(),L=Object.keys(S.pools).map(function(k){return S.pools[k]});
 L=L.filter(function(p){return (S.flt==="all"||p.pr===S.flt)&&(!q||(p.A.s+"/"+p.B.s+" "+p.A.m+" "+p.B.m+" "+p.id).toLowerCase().indexOf(q)>=0)});
 var k=S.sort;L.sort(function(a,b){return (b[k]||0)-(a[k]||0)});return L;
}
function rPools(){
 var L=filt(),chips=["all","Orca","Raydium","Meteora"].map(function(x){return '<button class="btn chip'+(S.flt===x?" on":"")+'" data-flt="'+x+'">'+(x==="all"?"Todas":x)+"</button>"}).join("");
 var st=Object.keys(SRC).map(function(n){var s=S.stat[n];return n+": "+(s?esc(s):"cargando…")}).join(" · ");
 var rows=L.slice(0,S.lim).map(function(p){
  return '<div class="row pick" data-pool="'+esc(p.k)+'"><div><b>'+esc(p.A.s)+"/"+esc(p.B.s)+'</b><span class="tag o">'+p.pr+'</span><small>TVL $'+f(p.tvl,0)+(p.fee!=null?" · comisión "+f(p.fee,2)+"%":"")+'</small></div><div class="v"><b class="up">'+(p.apr!=null?f(p.apr,1)+"%":"—")+"</b><small>APR · vol. $"+f(p.vol,0)+"</small></div></div>"}).join("");
 var h=$("pools");h.innerHTML='<div class="k">Solana · pools de liquidez <small>'+L.length+' pools</small></div>'+
  '<input id="pq" placeholder="Buscar par o token (SOL, HYPE, USDC…)" value="'+esc(S.q)+'" autocomplete="off"><div class="chips">'+chips+
  '<select id="psort" style="flex:none;width:auto"><option value="tvl"'+(S.sort==="tvl"?" selected":"")+'>Ordenar: TVL</option><option value="vol"'+(S.sort==="vol"?" selected":"")+'>Ordenar: volumen</option><option value="apr"'+(S.sort==="apr"?" selected":"")+">Ordenar: APR</option></select></div>'+
  '<div class="stat">'+st+'</div><div class="plist" id="plist">'+(rows||'<div class="dim" style="margin-top:10px">Sin resultados todavía.</div>')+"</div>"+(L.length>S.lim?'<button class="btn p" style="background:rgba(255,255,255,.1);color:#fff" data-act="more">Ver más</button>':"");
 var pq=$("pq");if(S.focusQ){pq.focus();pq.setSelectionRange(pq.value.length,pq.value.length)}
}
var qT=null;

/* ---------- Crear posición ---------- */
var ST={r:5,cmin:"",cmax:"",pay:"B",amt:"",auto:true,via:"Jupiter",slip:1};
function pcalc(){
 var p=S.pools[S.sel],z=ST,pr=p.p,pa,pb;
 if(z.r==="c"&&parseFloat(z.cmin)>0&&parseFloat(z.cmax)>parseFloat(z.cmin)){pa=+z.cmin;pb=+z.cmax}else{var r=z.r==="c"?5:z.r;pa=pr*(1-r/100);pb=pr*(1+r/100)}
 var sp=Math.sqrt(pr),x,y;
 if(pr<=pa){x=1/Math.sqrt(pa)-1/Math.sqrt(pb);y=0}else if(pr>=pb){x=0;y=Math.sqrt(pb)-Math.sqrt(pa)}else{x=1/sp-1/Math.sqrt(pb);y=sp-Math.sqrt(pa)}
 var vx=x*pr,fa=vx+y>0?vx/(vx+y):.5,a=parseFloat(z.amt)||0,payB=z.pay==="B",tB=payB?a:a*pr,vA=tB*fa,vB=tB-vA;
 return{p:p,pa:pa,pb:pb,fa:fa,aA:vA/pr,aB:vB,payB:payB,a:a,swapIn:payB?vA:vB/pr};
}
function sumPs(){
 var p=S.pools[S.sel];if(!p||!(p.p>0)){return}
 var c=pcalc(),pay=c.payB?p.B:p.A,oth=c.payB?p.A:p.B;
 $("prg").textContent="Rango: "+fp(c.pa)+" – "+fp(c.pb)+" "+p.B.s+" por "+p.A.s;
 $("psum").innerHTML="<div>"+esc(p.A.s)+" "+f(c.fa*100,1)+'% → <b class="num">'+f(c.aA,6)+" "+esc(p.A.s)+"</b></div><div>"+esc(p.B.s)+" "+f((1-c.fa)*100,1)+'% → <b class="num">'+f(c.aB,6)+" "+esc(p.B.s)+"</b></div>"+
  (ST.auto?'<div class="dim">Autoswap: cambiar <b class="num">'+f(c.swapIn,6)+" "+esc(pay.s)+"</b> por "+esc(oth.s)+" vía "+ST.via+"</div>":'<div class="dim">Sin autoswap: necesitas ya las dos monedas.</div>');
 var b=S.bal[pay.m];$("pbal").textContent=S.pk?"Saldo: "+f(b||0,6)+" "+pay.s:"Conecta Phantom para ver tu saldo.";
}
function rPs(){
 var p=S.pools[S.sel],el=$("ps");if(!p){el.hidden=true;return}
 var z=ST,chips=[1,5,10].map(function(x){return '<button class="btn chip'+(z.r===x?" on":"")+'" data-pr="'+x+'">±'+x+"%</button>"}).join("")+'<button class="btn chip'+(z.r==="c"?" on":"")+'" data-pr="c">Personal.</button>',
 cu=z.r==="c"?'<div class="two"><input id="cmin" class="num" type="number" step="any" placeholder="Mín." value="'+esc(z.cmin)+'"><input id="cmax" class="num" type="number" step="any" placeholder="Máx." value="'+esc(z.cmax)+'"></div>':"",
 vo=VEN.map(function(v){return "<option"+(v===z.via?" selected":"")+">"+v+"</option>"}).join(""),
 sl=[.5,1,3].map(function(v){return '<option value="'+v+'"'+(v===z.slip?" selected":"")+">"+v+"%</option>"}).join("");
 el.style.setProperty("--tc","20,241,149");
 el.innerHTML='<div class="mb"><button class="x" data-act="closeps" aria-label="Cerrar">×</button><b style="font-size:20px">Crear posición</b><div class="dim">'+esc(p.A.s)+"/"+esc(p.B.s)+" · "+p.pr+(p.fee!=null?" · comisión "+f(p.fee,2)+"%":"")+" · precio "+fp(p.p)+" "+esc(p.B.s)+" por "+esc(p.A.s)+"</div>"+
 '<label>Rango de precio</label><div class="chips">'+chips+"</div>"+cu+'<div class="dim" id="prg" style="margin-top:6px"></div>'+
 '<label for="pa">Cantidad de depósito</label><div class="box"><div class="srow"><select id="ppay"><option value="A"'+(z.pay==="A"?" selected":"")+">"+esc(p.A.s)+'</option><option value="B"'+(z.pay==="B"?" selected":"")+">"+esc(p.B.s)+'</option></select><input id="pa" class="num" type="number" inputmode="decimal" min="0" step="any" value="'+esc(z.amt)+'" placeholder="0.0"></div><div class="dim" id="pbal" style="margin-top:6px"></div></div>'+
 '<div class="hrow"><label class="tg"><input type="checkbox" id="pau"'+(z.auto?" checked":"")+'>Autoswap</label><span class="dim">Operar vía <select id="pvia">'+vo+'</select></span><span class="dim">Desliz. <select id="pslp">'+sl+"</select></span></div>"+
 '<div class="sum" id="psum"></div>'+
 (p.pr==="Orca"?'<button class="btn p" style="background:rgba(255,255,255,.1);color:#fff" data-act="preview">Calcular posición</button><button class="btn p" data-act="create">Firmar y crear posición (NFT)</button>':"")+'<div class="stat" id="pres"></div>'+
 '<a class="btn'+(p.pr==="Orca"?"":" p")+'" style="display:block;margin-top:10px" href="'+esc(p.url)+'" target="_blank" rel="noopener">'+(p.pr==="Orca"?"Ver pool en Orca ↗":"Crear posición en "+p.pr+" ↗ (dentro de Kosmara, próximamente)")+"</a>"+
 '<div class="dim" style="margin-top:10px">Kosmara arma la transacción y la firmas tú: el NFT de la posición llega directo a tu wallet y no custodiamos nada. El autoswap deja tus fondos en la proporción del rango. DFlow entra dentro de la opción Jupiter.</div></div>';
 el.hidden=false;sumPs();
}
/* ---------- Crear posición en Orca: la web arma la transacción y la firma el usuario ---------- */
var PREV=null;
function toBig(x,d){return BigInt(Math.floor(x*Math.pow(10,d)))}
function hum(b,d){return Number(b)/Math.pow(10,d)}
function balH(t){var b=S.bal[t.m]||0;return t.m===SOLM?Math.max(b-0.02,0):b}
function pparam(p,c,real){
 var sc=1;
 if(real){var bA=balH(p.A),bB=balH(p.B);if(c.aA>0)sc=Math.min(sc,bA/c.aA);if(c.aB>0)sc=Math.min(sc,bB/c.aB)}
 sc=Math.max(sc,0)*0.995;
 return c.aA>0?{tokenA:toBig(c.aA*sc,p.A.d)}:{tokenB:toBig(c.aB*sc,p.B.d)};
}
async function previewPos(sw){
 var p=S.pools[S.sel],c=pcalc(),r=function(h){$("pres").innerHTML=h};
 if(p.pr!=="Orca"){r("Dentro de Kosmara, de momento, solo Orca.");return null}
 if(!S.pk||!WAL){r("Conecta tu wallet primero.");return null}
 if(!(c.a>0)||!(p.p>0)){r("Introduce una cantidad.");return null}
 try{
  r("Calculando la posición…");await setWhirlpoolsConfig("solanaMainnet");
  var param=pparam(p,c,!ST.auto||sw),v=param.tokenA!=null?param.tokenA:param.tokenB;
  if(!(v>0n)){r("Sin autoswap necesitas tener las dos monedas en tu wallet.");return null}
  var res=await openPositionInstructions(rpcK(),address(p.id),param,c.pa,c.pb,Math.round(ST.slip*100),createNoopSigner(address(S.pk))),q=res.quote;
  PREV={id:p.id,res:res};
  r('Posición lista para firmar:<br>Depósito estimado: <b class="num">'+f(hum(q.tokenEstA,p.A.d),6)+" "+esc(p.A.s)+'</b> + <b class="num">'+f(hum(q.tokenEstB,p.B.d),6)+" "+esc(p.B.s)+"</b><br>Máximo con deslizamiento: "+f(hum(q.tokenMaxA,p.A.d),6)+" "+esc(p.A.s)+" / "+f(hum(q.tokenMaxB,p.B.d),6)+" "+esc(p.B.s)+"<br>Coste de inicialización: "+f(hum(res.initializationCost,9),5)+" SOL");
  return res;
 }catch(e){r("No se pudo calcular: "+esc((e&&e.message)||e));return null}
}
async function createPos(){
 var p=S.pools[S.sel],c=pcalc(),r=function(h){$("pres").innerHTML=h},res=await previewPos(false);
 if(!res)return;
 var sw=ST.auto&&c.swapIn>0;
 if(!confirm("Vas a firmar en tu wallet:\n"+(sw?"1) un swap REAL (autoswap)\n2) ":"")+"la apertura de una posición REAL en Orca ("+p.A.s+"/"+p.B.s+").\nEl NFT de la posición llegará a tu wallet. Revisa cada transacción antes de aprobar."))return r("Cancelado.");
 try{
  if(sw){
   var pay=c.payB?p.B:p.A,oth=c.payB?p.A:p.B,amt=Math.floor(c.swapIn*Math.pow(10,pay.d));
   if(!S.key)return r("Falta la clave de Jupiter (bloque Conexiones).");
   r("1/2 Autoswap: esperando tu firma…");var sg=await execSwap(ST.via,pay.m,oth.m,amt,ST.slip);if(sg)await confirmSig(sg);
   await loadBal();res=await previewPos(true);if(!res)return;
  }
  r((sw?"2/2 ":"")+"Esperando tu firma para abrir la posición…");
  var rpc=rpcK(),bh=(await rpc.getLatestBlockhash().send()).value,signer=createNoopSigner(address(S.pk)),
  msg=pipe(createTransactionMessage({version:0}),function(m){return setTransactionMessageFeePayerSigner(signer,m)},function(m){return setTransactionMessageLifetimeUsingBlockhash(bh,m)},function(m){return appendTransactionMessageInstructions(res.instructions,m)}),
  tx=await partiallySignTransactionMessageWithSigners(msg),sig=await sendBytes(getTransactionEncoder().encode(tx));
  r("Confirmando en la red…");await confirmSig(sig);
  r('Posición creada. NFT: <span class="num">'+esc(short(String(res.positionMint)))+'</span><br><a class="lk" href="https://solscan.io/tx/'+esc(sig)+'" target="_blank" rel="noopener">Ver transacción ↗</a> · <a class="lk" href="https://solscan.io/token/'+esc(String(res.positionMint))+'" target="_blank" rel="noopener">Ver NFT ↗</a>');
  loadBal();
 }catch(e){r("No se pudo completar: "+esc((e&&e.message)||e))}
}

/* ---------- Wallets ---------- */
async function loadBal(){
 if(!S.pk)return;
 try{var o={};o[SOLM]=(await rc("getBalance",[S.pk])).value/1e9;
  await Promise.all(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].map(async function(pg){
   var t=await rc("getTokenAccountsByOwner",[S.pk,{programId:pg},{encoding:"jsonParsed"}]);
   t.value.forEach(function(a){var i=a.account.data.parsed.info;o[i.mint]=(o[i.mint]||0)+(i.tokenAmount.uiAmount||0)})}));
  S.bal=o}
 catch(e){toast("No se pudo leer tu saldo: "+e.message)}
}
function solWallets(){return getWallets().get().filter(function(w){return w.features["standard:connect"]&&w.features["solana:signTransaction"])}
async function wallet(w){
 try{
  if(w==="mm")return toast("MetaMask se usará cuando conectemos Ethereum y BNB Chain. Esta versión es solo Solana.");
  var L=solWallets(),pw=L.filter(function(x){return /phantom/i.test(x.name)})[0]||L[0];
  if(!pw)throw new Error("No se detectó una wallet de Solana. En el móvil, abre la web dentro de Phantom (enlace del cuadro).");
  var r=await pw.features["standard:connect"].connect();WAL=pw;ACC=r.accounts[0];S.pk=ACC.address;S.wname=pw.name;
  $("addr").value=S.pk;$("bConn").textContent=pw.name+" "+short(S.pk);$("sheet").hidden=true;await loadBal();rSwap();sumPsSafe();
 }catch(x){toast(x.message||"No se pudo conectar.")}
}
function sumPsSafe(){if(S.sel&&!$("ps").hidden)sumPs()}

/* ---------- Movimientos reales ---------- */
var BS="https://eth.blockscout.com/api/v2/addresses/";
var MINT={EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:"USDC",So11111111111111111111111111111111111111112:"wSOL",JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:"JUP"};
function iso(t){return t?new Date(t*1e3).toISOString().slice(0,19).replace("T"," "):""}
function stt(t){$("hst").textContent=t}
function solRows(s,tx,a){
 var b={d:iso(s.blockTime),red:"Solana",ty:"tx",h:s.signature,est:s.err?"error":"ok",dir:"",imp:"",act:"SOL",fee:"",cp:""};
 if(!tx||!tx.meta)return[b];
 var ks=tx.transaction.message.accountKeys,i=-1,m=tx.meta,R=[],T={};
 ks.forEach(function(k,n){if((k.pubkey||k)===a)i=n});
 var fee=i===0?m.fee/1e9:0,dl=i>=0?(m.postBalances[i]-m.preBalances[i])/1e9+fee:0;
 (m.preTokenBalances||[]).forEach(function(x){if(x.owner===a)T[x.mint]=(T[x.mint]||0)-(x.uiTokenAmount.uiAmount||0)});
 (m.postTokenBalances||[]).forEach(function(x){if(x.owner===a)T[x.mint]=(T[x.mint]||0)+(x.uiTokenAmount.uiAmount||0)});
 var tk2=Object.keys(T).filter(function(k){return Math.abs(T[k])>1e-12});
 if(Math.abs(dl)>1e-12||fee||!tk2.length){b.imp=dl;b.dir=dl>0?"entrada":dl<0?"salida":"otro";b.fee=fee||"";R.push(b)}
 tk2.forEach(function(k){var c=Object.assign({},b);c.ty="token";c.imp=T[k];c.dir=T[k]>0?"entrada":"salida";c.act=MINT[k]||k.slice(0,4)+"…"+k.slice(-4);c.fee="";R.push(c)});
 return R}
async function histSol(a){
 var H={"Content-Type":"application/json"},r=await fetch(rpcUrl(),{method:"POST",headers:H,body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getSignaturesForAddress",params:[a,{limit:40}]})});
 if(!r.ok)throw new Error("HTTP "+r.status);var j=await r.json();if(j.error)throw new Error(j.error.message);
 var sg=j.result,R=[];
 for(var i=0;i<sg.length;i+=10){var ch=sg.slice(i,i+10),txs=[];stt("Leyendo movimientos "+Math.min(i+10,sg.length)+" de "+sg.length+"…");
  try{var rr=await fetch(rpcUrl(),{method:"POST",headers:H,body:JSON.stringify(ch.map(function(s,k){return{jsonrpc:"2.0",id:k,method:"getTransaction",params:[s.signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0}]}}))}),jx=await rr.json();if(Array.isArray(jx))jx.forEach(function(o){txs[o.id]=o.result})}catch(e){}
  ch.forEach(function(s,k){solRows(s,txs[k],a).forEach(function(x){R.push(x)})});
  await new Promise(function(z){setTimeout(z,350)})}
 return R}
async function jget(u){var r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
async function histEth(a){
 stt("Leyendo movimientos de Ethereum…");
 var tx=await jget(BS+a+"/transactions"),tt=await jget(BS+a+"/token-transfers").catch(function(){return{items:[]}}),R=[],al=a.toLowerCase();
 (tx.items||[]).forEach(function(t){var fr=((t.from&&t.from.hash)||"").toLowerCase(),to=(t.to&&t.to.hash)||"",v=Number(t.value||0)/1e18,out=fr===al;
  R.push({d:(t.timestamp||"").slice(0,19).replace("T"," "),red:"Ethereum",ty:t.method||"tx",h:t.hash,est:t.status==="ok"?"ok":"error",dir:v===0?"otro":out?"salida":"entrada",imp:out?-v:v,act:"ETH",fee:out&&t.fee?Number(t.fee.value)/1e18:"",cp:out?to:((t.from&&t.from.hash)||"")})});
 (tt.items||[]).forEach(function(t){var tok=t.token||{},dec=+((t.total&&t.total.decimals)||tok.decimals||0),v=Number((t.total&&t.total.value)||0)/Math.pow(10,dec),out=((t.from&&t.from.hash)||"").toLowerCase()===al;
  R.push({d:(t.timestamp||"").slice(0,19).replace("T"," "),red:"Ethereum",ty:"token",h:t.transaction_hash||t.tx_hash||"",est:"ok",dir:out?"salida":"entrada",imp:out?-v:v,act:tok.symbol||"?",fee:"",cp:out?((t.to&&t.to.hash)||""):((t.from&&t.from.hash)||"")})});
 R.sort(function(x,y){return x.d<y.d?1:-1});return R}
function qv(v){v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function num(x){return x===""?"":String(+Number(x).toFixed(9))}
function makeCsv(){var L=["fecha_utc,red,tipo,hash,estado,direccion,importe,activo,comision_nativa,contraparte"];S.rows.forEach(function(r){L.push([r.d,r.red,r.ty,r.h,r.est,r.dir,num(r.imp),r.act,num(r.fee),r.cp].map(qv).join(","))});return L.join("\n")}
function sh(h){return h&&h.length>14?h.slice(0,6)+"…"+h.slice(-4):h}
function showHist(){
 CSV=makeCsv();var R=S.rows,lk=S.net==="sol"?"https://solscan.io/tx/":"https://etherscan.io/tx/";
 if(!R.length){$("hres").innerHTML='<div class="dim" style="margin-top:12px">Esta dirección no tiene movimientos.</div>';return}
 var rows=R.slice(0,30).map(function(r){return "<tr><td>"+esc(r.d)+"</td><td>"+esc(r.ty)+'</td><td class="'+(r.dir==="entrada"?"up":r.dir==="salida"?"dn":"")+'">'+r.dir+'</td><td class="num">'+(r.imp===""?"":f(r.imp,6))+" "+esc(r.act)+'</td><td><a class="lk" href="'+lk+esc(r.h)+'" target="_blank" rel="noopener">'+esc(sh(r.h))+"</a></td></tr>"}).join("");
 $("hres").innerHTML='<div class="scroll"><table><tr><th>Fecha (UTC)</th><th>Tipo</th><th>Dirección</th><th>Importe</th><th>Hash</th></tr>'+rows+"</table></div>"+(R.length>30?'<div class="dim" style="margin-top:8px">Mostrando 30 de '+R.length+" filas. El CSV las incluye todas.</div>":"")+
 '<div class="two"><button class="btn" data-act="dl">Descargar CSV</button><button class="btn" data-act="copy">Copiar CSV</button></div><label for="csv">Vista previa del CSV</label><textarea id="csv" readonly>'+esc(CSV)+"</textarea>";
}
async function loadHist(){
 var a=$("addr").value.trim(),net=/^0x[0-9a-fA-F]{40}$/.test(a)?"eth":/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)?"sol":"";
 if(!net)return stt("La dirección no parece válida. Pega una clave pública de Solana o de Ethereum (empieza por 0x).");
 S.addr=a;S.net=net;$("hres").innerHTML="";stt("Conectando con "+(net==="sol"?"Solana":"Ethereum")+"…");
 try{S.rows=net==="sol"?await histSol(a):await histEth(a);showHist();
  var blank=net==="sol"&&S.rows.length&&S.rows.every(function(r){return r.imp===""});
  stt(S.rows.length+" filas cargadas de "+(net==="sol"?"Solana (últimas 40 transacciones)":"Ethereum (página más reciente)")+(blank?". El nodo no devolvió los importes; prueba con un RPC propio en Conexiones.":"."))}
 catch(e){stt("No se pudo leer: "+(e&&e.message)+". Los nodos públicos tienen límites; prueba un RPC propio en Conexiones.")}
}
function dlCsv(){if(!CSV)return;var b=new Blob(["\ufeff"+CSV],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(b),l=document.createElement("a");l.href=u;l.download="movimientos-"+S.addr.slice(0,6)+".csv";document.body.appendChild(l);l.click();l.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);toast("Descarga iniciada. Si no aparece, usa Copiar CSV.")}
function copyCsv(){var ta=$("csv"),ok=false;try{navigator.clipboard.writeText(CSV);ok=true}catch(e){}if(!ok){try{ta.select();ok=document.execCommand("copy")}catch(e){}}toast(ok?"CSV copiado.":"No se pudo copiar solo: mantén pulsado el texto y copia.")}

/* ---------- eventos ---------- */
document.addEventListener("click",function(e){
 var q=function(s){return e.target.closest(s)},a=q("[data-act]"),w=q("[data-w]"),pl=q("[data-pool]"),fl=q("[data-flt]"),pr=q("[data-pr]"),rt=q("[data-rt]"),pc=q("[data-pct]");
 if(e.target===$("sheet"))$("sheet").hidden=true;
 if(e.target===$("ps")){S.sel="";rPs()}
 if(w)return wallet(w.getAttribute("data-w"));
 if(pl){S.sel=pl.getAttribute("data-pool");var p=S.pools[S.sel];ST.pay=p&&p.B.s&&/USD/.test(p.B.s)?"B":"B";ST.amt="";rPs();return}
 if(fl){S.flt=fl.getAttribute("data-flt");S.focusQ=false;return rPools()}
 if(pr){var v=pr.getAttribute("data-pr");ST.r=v==="c"?"c":+v;return rPs()}
 if(rt){SW.sel=rt.getAttribute("data-rt");return rQt()}
 if(pc){var t=TM[SW.from];SW.amt=String(Math.floor((S.bal[t.m]||0)*pc.getAttribute("data-pct")/100*1e6)/1e6);return rSwap()}
 if(a){var m=a.getAttribute("data-act");
  if(m==="open"){$("lPh").href="https://phantom.app/ul/browse/"+encodeURIComponent(location.href)+"?ref="+encodeURIComponent(location.origin);$("lMm").href="https://metamask.app.link/dapp/"+location.host+location.pathname;$("sheet").hidden=false}
  else if(m==="close")$("sheet").hidden=true;else if(m==="closeps"){S.sel="";rPs()}
  else if(m==="quote")quoteAll();else if(m==="doswap")doSwap();else if(m==="preview")previewPos();else if(m==="create")createPos();
  else if(m==="more"){S.lim+=40;rPools()}else if(m==="load")loadHist();else if(m==="dl")dlCsv();else if(m==="copy")copyCsv();
  else if(m==="flip"){var z=SW.from;SW.from=SW.to;SW.to=z;SW.amt="";SW.res=[];rSwap()}}
});
document.addEventListener("input",function(e){
 var t=e.target,id=t.id;
 if(id==="amt"){SW.amt=t.value;SW.res=[];rQt()}
 else if(id==="pq"){S.q=t.value;S.focusQ=true;rPools();clearTimeout(qT);if(t.value.trim().length>=2)qT=setTimeout(function(){loadPools(t.value.trim())},600)}
 else if(id==="pa"){ST.amt=t.value;sumPs()}else if(id==="cmin"){ST.cmin=t.value;sumPs()}else if(id==="cmax"){ST.cmax=t.value;sumPs()}
});
document.addEventListener("change",function(e){
 var t=e.target,id=t.id;
 if(id==="sf"){SW.from=t.value;SW.amt="";SW.res=[];rSwap()}else if(id==="st"){SW.to=t.value;SW.res=[];rSwap()}else if(id==="sw-slip"){SW.slip=+t.value;SW.res=[];rQt()}
 else if(id==="psort"){S.sort=t.value;S.focusQ=false;rPools()}
 else if(id==="ppay"){ST.pay=t.value;sumPs()}else if(id==="pau"){ST.auto=t.checked;sumPs()}else if(id==="pvia"){ST.via=t.value;sumPs()}else if(id==="pslp"){ST.slip=+t.value;sumPs()}
 else if(id==="jk"){S.key=t.value.trim();LS("kz_jup",S.key);toast("Clave de Jupiter guardada en este navegador.")}
 else if(id==="rp"){S.rpc=t.value.trim();LS("kz_rpc",S.rpc);toast("RPC guardado.");if(S.pk)loadBal().then(rSwap)}
});
$("addr").addEventListener("keydown",function(e){if(e.key==="Enter")loadHist()});

rSwap();rCfg();rPools();loadPools();
