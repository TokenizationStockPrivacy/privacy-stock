const fs=require('node:fs');
const path=require('node:path');
const solc=require('solc');
const root=path.resolve(__dirname,'..');
const files=fs.readdirSync(path.join(root,'contracts/src')).filter(x=>x.endsWith('.sol'));
const sources=Object.fromEntries(files.map(f=>['src/'+f,{content:fs.readFileSync(path.join(root,'contracts/src',f),'utf8')}]));
const settings={optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}};
const imported={};
const input={language:'Solidity',sources,settings};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{
  const file=path.join(root,'node_modules',p);
  if(!fs.existsSync(file))return {error:'Missing import '+p};
  const content=fs.readFileSync(file,'utf8');
  imported[p]={content};
  return {contents:content};
}}));
if((output.errors||[]).some(e=>e.severity==='error'))throw Error(output.errors.map(e=>e.formattedMessage).join('\n'));
const complete={language:'Solidity',sources:{...sources,...imported},settings};
const again=JSON.parse(solc.compile(JSON.stringify(complete)));
if((again.errors||[]).some(e=>e.severity==='error'))throw Error(again.errors.map(e=>e.formattedMessage).join('\n'));
for(const name of ['AppleVault','FeeManager','RewardsVault','AppleFeeVault']){
 const file='src/'+name+'.sol';
 const a=output.contracts[file][name].evm.bytecode.object;
 const b=again.contracts[file][name].evm.bytecode.object;
 if(a!==b)throw Error(name+' compilation changed when imports were embedded');
}
const dir=path.join(root,'verification');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'standard-input.json'),JSON.stringify(complete));
fs.writeFileSync(path.join(dir,'compiler-version.txt'),solc.version()+'\n');
console.log(JSON.stringify({compiler:solc.version(),sourceCount:Object.keys(complete.sources).length,bytecodeMatches:true}));
