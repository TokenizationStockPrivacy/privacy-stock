const fs = require('fs');
const path = require('path');
const solc = require('solc');
const root = path.join(process.cwd(), 'contracts');
const files = fs.readdirSync(path.join(root, 'src')).filter(x => x.endsWith('.sol'));
const sources = Object.fromEntries(files.map(f => ['src/' + f, {content: fs.readFileSync(path.join(root, 'src', f), 'utf8')}]));
const input = {language: 'Solidity', sources, settings: {optimizer: {enabled: true, runs: 200}, outputSelection: {'*': {'*': ['abi', 'evm.bytecode.object']}}}};
const output = JSON.parse(solc.compile(JSON.stringify(input), {import: p => {
  try { return {contents: fs.readFileSync(path.join(process.cwd(), 'node_modules', p), 'utf8')}; }
  catch { return {error: 'not found ' + p}; }
}}));
for (const e of output.errors || []) console.log(e.formattedMessage);
if ((output.errors || []).some(e => e.severity === 'error')) process.exit(1);
const vault = output.contracts['src/AppleVault.sol'].AppleVault;
const artifactPath = path.join(process.cwd(), 'apps/web/lib/artifacts/AppleVault.json');
fs.mkdirSync(path.dirname(artifactPath), {recursive: true});
fs.writeFileSync(artifactPath, JSON.stringify({abi: vault.abi, bytecode: '0x' + vault.evm.bytecode.object}, null, 2) + '\n');
for (const name of ['FeeManager', 'RewardsVault', 'AppleFeeVault']) {
  const contract = output.contracts[`src/${name}.sol`][name];
  const target = path.join(process.cwd(), `apps/web/lib/artifacts/${name}.json`);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, JSON.stringify({abi:contract.abi, bytecode:'0x'+contract.evm.bytecode.object}, null, 2)+'\n');
}
console.log('Compiled:', Object.values(output.contracts).flatMap(x => Object.keys(x)).join(', '));
