import {createPublicClient, http, parseAbi} from 'viem';
import {base} from 'viem/chains';

const client = createPublicClient({chain:base, transport:http('https://mainnet.base.org')});
const token='0xb200000000000000000000C2e324d24d7eEcd1fb';
const feed='0x787f13dEa48Db0897CbCDD985de77809D837F988';
const erc20=parseAbi(['function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)']);
const oracle=parseAbi(['function decimals() view returns (uint8)','function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)']);
const chainId=await client.getChainId();
if(chainId!==8453) throw Error(`wrong chain: ${chainId}`);
const [name,symbol,decimals,feedDecimals,round]=await Promise.all([
  client.readContract({address:token,abi:erc20,functionName:'name'}),
  client.readContract({address:token,abi:erc20,functionName:'symbol'}),
  client.readContract({address:token,abi:erc20,functionName:'decimals'}),
  client.readContract({address:feed,abi:oracle,functionName:'decimals'}),
  client.readContract({address:feed,abi:oracle,functionName:'latestRoundData'})
]);
console.log(JSON.stringify({chainId,token,name,symbol,decimals,feed,feedDecimals,roundId:round[0].toString(),price:round[1].toString(),updatedAt:round[3].toString()},null,2));
