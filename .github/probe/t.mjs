import * as W from "@solana/web3.js";
const K="jup_pub_fc0db5fe4cd24284045be587a267338b6e067d0f97e76712fbf9692bd3830f69",H={"x-api-key":K,"Origin":"https://cristiancgrd13-cpu.github.io"};
const RPC="https://mainnet.helius-rpc.com/?api-key=d69a3929-b7b3-4523-8dea-9d82a0bcfd36";
const rc=async(m,p)=>{const r=await fetch(RPC,{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://cristiancgrd13-cpu.github.io"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})});const j=await r.json();if(j.error)throw new Error(JSON.stringify(j.error));return j.result};
const SOL="So11111111111111111111111111111111111111112",USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// payer: big funded account (Jupiter needs ATAs etc.; simulation only)
const PK=process.argv[2];
for(const [im,om,amt] of [[SOL,USDC,10000000],[USDC,SOL,1000000]]){
 const q=await (await fetch(`https://api.jup.ag/swap/v1/quote?inputMint=${im}&outputMint=${om}&amount=${amt}&slippageBps=100`,{headers:H})).json();
 console.log("quote out",q.outAmount,"usd",q.swapUsdValue,q.error||"");
 const si=await (await fetch("https://api.jup.ag/swap/v1/swap-instructions",{method:"POST",headers:{...H,"Content-Type":"application/json"},body:JSON.stringify({quoteResponse:q,userPublicKey:PK,dynamicComputeUnitLimit:true,dynamicSlippage:false})})).json();
 if(si.error){console.log("SI error",si.error);continue}
 const ix=x=>new W.TransactionInstruction({programId:new W.PublicKey(x.programId),keys:x.accounts.map(a=>({pubkey:new W.PublicKey(a.pubkey),isSigner:a.isSigner,isWritable:a.isWritable})),data:Buffer.from(x.data,"base64")});
 const ixs=[...(si.computeBudgetInstructions||[]).map(ix),...(si.setupInstructions||[]).map(ix),ix(si.swapInstruction),...(si.cleanupInstruction?[ix(si.cleanupInstruction)]:[]),...(si.otherInstructions||[]).map(ix)];
 ixs.push(W.SystemProgram.transfer({fromPubkey:new W.PublicKey(PK),toPubkey:new W.PublicKey("7ZeR8DKhdDDXsYHk5oBWPvf9edAzF6cvaJBmuJsry9Uw"),lamports:20000}));
 const alts=[];for(const a of si.addressLookupTableAddresses||[]){const ai=await rc("getAccountInfo",[a,{encoding:"base64"}]);alts.push(new W.AddressLookupTableAccount({key:new W.PublicKey(a),state:W.AddressLookupTableAccount.deserialize(Buffer.from(ai.value.data[0],"base64"))}))}
 const bh=await rc("getLatestBlockhash",[{commitment:"confirmed"}]);
 const tx=new W.VersionedTransaction(new W.TransactionMessage({payerKey:new W.PublicKey(PK),recentBlockhash:bh.value.blockhash,instructions:ixs}).compileToV0Message(alts));
 const raw=Buffer.from(tx.serialize()).toString("base64");console.log("tx bytes",tx.serialize().length,"alts",alts.length);
 const sim=await rc("simulateTransaction",[raw,{encoding:"base64",sigVerify:false,replaceRecentBlockhash:true}]);
 console.log("SIM err",JSON.stringify(sim.value.err),"logs tail:",(sim.value.logs||[]).slice(-4).join(" | "));
}
const fb=await rc("getBalance",["7ZeR8DKhdDDXsYHk5oBWPvf9edAzF6cvaJBmuJsry9Uw"]);console.log("fee wallet lamports",fb.value);
