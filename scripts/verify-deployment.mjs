import {readFileSync} from 'node:fs';
import {createPublicClient, encodeDeployData, getAddress, http} from 'viem';
import {base} from 'viem/chains';

const hash=process.argv[2];
if(!/^0x[0-9a-fA-F]{64}$/.test(hash||'')) throw Error('Pass a transaction hash');
const client=createPublicClient({chain:base,transport:http('https://mainnet.base.org')});
if(await client.getChainId()!==8453) throw Error('Wrong chain');
const artifact=JSON.parse(readFileSync(new URL('../apps/web/lib/artifacts/AppleVault.json',import.meta.url),'utf8'));
const aaplc=getAddress('0xb200000000000000000000C2e324d24d7eEcd1fb');
const [receipt,tx]=await Promise.all([client.getTransactionReceipt({hash}),client.getTransaction({hash})]);
if(receipt.status!=='success'||!receipt.contractAddress) throw Error('No successful contract creation receipt');
if(tx.to!==null) throw Error('Transaction did not directly create a contract');
const expectedInput=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode,args:[aaplc]});
if(tx.input.toLowerCase()!==expectedInput.toLowerCase()) throw Error('Transaction input differs from compiled AppleVault');
const address=getAddress(receipt.contractAddress);
const [code,asset,reclaimDelay,totalLocked]=await Promise.all([
  client.getBytecode({address}),
  client.readContract({address,abi:artifact.abi,functionName:'asset'}),
  client.readContract({address,abi:artifact.abi,functionName:'RECLAIM_DELAY'}),
  client.readContract({address,abi:artifact.abi,functionName:'totalLocked'})
]);
if(!code||code==='0x'||getAddress(asset)!==aaplc) throw Error('Deployed contract or asset mismatch');
console.log(JSON.stringify({chainId:8453,hash,address,blockNumber:receipt.blockNumber.toString(),status:receipt.status,asset:getAddress(asset),reclaimDelaySeconds:reclaimDelay.toString(),totalLocked:totalLocked.toString(),deployedBytecodeBytes:(code.length-2)/2},null,2));
