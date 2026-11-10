import {readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,encodeDeployData,getAddress,http} from 'viem';
import {base} from 'viem/chains';

const root=new URL('../apps/web/lib/artifacts/',import.meta.url);
const artifacts=Object.fromEntries(['FeeManager','RewardsVault','AppleFeeVault'].map(n=>[n,JSON.parse(readFileSync(new URL(`${n}.json`,root),'utf8'))]));
const hashes={FeeManager:'0x766a8de621fad6171474fc0dd26d20d382dc892bab86f17d925cf26702ff07b5',RewardsVault:'0x0352c11be07e05168518e6eec9ac5aacd6603a8f6adbfbc1f628a8c84632a153',AppleFeeVault:'0x166dc59413c8f6b1a572607ac72cf8c88852d0d504957b68e9c76b290f52504c',setCollector:'0x110f650f84e3c611e4b60c05443c4a78a49944c89ea698a9c15c96198ad75ebc'};
const expected={FeeManager:'0xb35fd984913e99f82c53e47e1013075a187b6d28',RewardsVault:'0x7d317b61055d344c334901976ebac10450566e6e',AppleFeeVault:'0x8178b76de28e880bb1435346a4c227c0b92bbecc'};
const asset=getAddress('0xb200000000000000000000C2e324d24d7eEcd1fb');
const feed=getAddress('0x787f13dEa48Db0897CbCDD985de77809D837F988');
const client=createPublicClient({chain:base,transport:http('https://mainnet.base.org')});
if(await client.getChainId()!==8453) throw Error('Wrong chain');
const owner=(await client.getTransaction({hash:hashes.FeeManager})).from;
const args={FeeManager:[asset,feed,BigInt(36*3600)],RewardsVault:[asset,owner,owner],AppleFeeVault:[asset,expected.FeeManager,expected.RewardsVault]};
const deployed={};
for(const name of ['FeeManager','RewardsVault','AppleFeeVault']){
  const [tx,receipt]=await Promise.all([client.getTransaction({hash:hashes[name]}),client.getTransactionReceipt({hash:hashes[name]})]);
  if(receipt.status!=='success'||!receipt.contractAddress||getAddress(receipt.contractAddress)!==getAddress(expected[name])||tx.to!==null||tx.from.toLowerCase()!==owner.toLowerCase()) throw Error(`${name} receipt mismatch`);
  const input=encodeDeployData({abi:artifacts[name].abi,bytecode:artifacts[name].bytecode,args:args[name]});
  if(input.toLowerCase()!==tx.input.toLowerCase()) throw Error(`${name} creation input mismatch`);
  if(!await client.getBytecode({address:expected[name]})) throw Error(`${name} missing bytecode`);
  deployed[name]={address:getAddress(expected[name]),transactionHash:hashes[name],blockNumber:Number(receipt.blockNumber)};
}
const c=await client.getTransactionReceipt({hash:hashes.setCollector});
const tx=await client.getTransaction({hash:hashes.setCollector});
if(c.status!=='success'||tx.to?.toLowerCase()!==expected.RewardsVault.toLowerCase()||tx.from.toLowerCase()!==owner.toLowerCase()) throw Error('Collector transaction mismatch');
async function read(name,fn){return client.readContract({address:expected[name],abi:artifacts[name].abi,functionName:fn});}
const fields={feeToken:await read('FeeManager','token'),priceFeed:await read('FeeManager','feed'),maxPriceAge:await read('FeeManager','maxAge'),rewardsAsset:await read('RewardsVault','asset'),rewardsOwner:await read('RewardsVault','owner'),collector:await read('RewardsVault','collector'),vaultAsset:await read('AppleFeeVault','asset'),vaultFeeManager:await read('AppleFeeVault','feeManager'),vaultRewardsVault:await read('AppleFeeVault','rewardsVault')};
for(const [field,value] of Object.entries({feeToken:asset,priceFeed:feed,rewardsAsset:asset,rewardsOwner:owner,collector:expected.AppleFeeVault,vaultAsset:asset,vaultFeeManager:expected.FeeManager,vaultRewardsVault:expected.RewardsVault})) if(String(fields[field]).toLowerCase()!==value.toLowerCase()) throw Error(`${field} mismatch`);
if(fields.maxPriceAge!==BigInt(36*3600)) throw Error('maxPriceAge mismatch');
const result={chainId:8453,asset,owner,feed,contracts:deployed,setCollector:{transactionHash:hashes.setCollector,blockNumber:Number(c.blockNumber)},verifiedAt:new Date().toISOString()};
writeFileSync(new URL('../deployments/base-mainnet-system.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
