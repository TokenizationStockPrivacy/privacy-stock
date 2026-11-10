import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=JSON.parse(readFileSync(path.join(root,'verification/standard-input.json'),'utf8'));
const compilerVersion=readFileSync(path.join(root,'verification/compiler-version.txt'),'utf8').trim().split('.Emscripten')[0];
const deployment=JSON.parse(readFileSync(path.join(root,'deployments/base-mainnet-system.json'),'utf8'));
const results={};
for(const name of ['FeeManager','RewardsVault','AppleFeeVault']){
 const {address,transactionHash}=deployment.contracts[name];
 const url=`https://sourcify.dev/server/v2/verify/8453/${address}`;
 const body={stdJsonInput:input,compilerVersion,contractIdentifier:`src/${name}.sol:${name}`,creationTransactionHash:transactionHash};
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const submitted=await response.json();
 console.log(name,'submit',response.status,JSON.stringify(submitted));
 if(!response.ok||!submitted.verificationId){results[name]={error:submitted};continue}
 let status;
 for(let attempt=0;attempt<12;attempt++){
   const r=await fetch(`https://sourcify.dev/server/v2/verify/${submitted.verificationId}`);
   status=await r.json();
   if(status.isJobCompleted||status.verificationStatus==='SUCCESS'||status.status==='SUCCESS'||status.status==='failed')break;
   await new Promise(resolve=>setTimeout(resolve,3000));
 }
 console.log(name,'result',JSON.stringify(status));
 const check=await fetch(`https://sourcify.dev/server/v2/contract/8453/${address}`);
 const match=check.ok?await check.json():null;
 results[name]={verificationId:submitted.verificationId,status,contractLookupStatus:check.status,match};
}
const target=path.join(root,'verification/sourcify-results.json');
writeFileSync(target,JSON.stringify(results,null,2)+'\n');
if(Object.values(results).some(r=>r.contractLookupStatus!==200))process.exitCode=1;
