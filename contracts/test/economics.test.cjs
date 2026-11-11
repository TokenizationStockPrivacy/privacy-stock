const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ganache = require('ganache');
const {ethers} = require('ethers');

const root = path.resolve(__dirname, '../..');
const sources = Object.fromEntries(fs.readdirSync(path.join(root, 'contracts/src')).filter(x => x.endsWith('.sol')).map(f => ['src/' + f, {content: fs.readFileSync(path.join(root, 'contracts/src', f), 'utf8')}]));
const compiled = JSON.parse(solc.compile(JSON.stringify({language:'Solidity', sources, settings:{optimizer:{enabled:true, runs:200}, outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}), {import:p=>({contents:fs.readFileSync(path.join(root,'node_modules',p),'utf8')})}));
assert.equal((compiled.errors||[]).filter(e=>e.severity==='error').length, 0);
const artifact = name => {
  const x = compiled.contracts[`src/${name}.sol`][name];
  return [x.abi, '0x'+x.evm.bytecode.object];
};
const deploy = async (name, signer, ...args) => (await new ethers.ContractFactory(...artifact(name), signer).deploy(...args)).waitForDeployment();

test('progressive boundaries, cap, stale pricing, and actual reward backing', async () => {
  const provider = new ethers.BrowserProvider(ganache.provider({logging:{quiet:true}}));
  const [alice, bob, collector] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
  const token = await deploy('MockAAPL', alice);
  const feed = await deploy('MockUsdFeed', alice);
  const block = await provider.getBlock('latest');
  await (await feed.set(100n*10n**8n, BigInt(block.timestamp))).wait();
  const fm = await deploy('FeeManager', alice, await token.getAddress(), await feed.getAddress(), 3600n);
  const usd = 10n**8n;
  for (const [value, expected] of [[1000,5],[2000,15],[10000,95],[12000,125],[100000,1445],[150000,2695]]) {
    assert.equal(await fm.feeUsdForValue(BigInt(value)*usd), BigInt(expected)*usd);
  }
  assert.equal(await fm.feeUsdForValue(1000000n*usd), 15000n*usd);
  const q = await fm.quote(20n*10n**18n);
  assert.equal(q.feeTokens, 15n*10n**16n); // $2,000 transfer at $100/share: $15 = 0.15 shares
  await (await feed.set(100n*usd, 1n)).wait();
  await assert.rejects(fm.quote(10n**18n));

  const vault = await deploy('RewardsVault', alice, await token.getAddress(), await alice.getAddress(), await collector.getAddress());
  await (await token.mint(await bob.getAddress(), 100n*10n**18n)).wait();
  await (await token.connect(bob).approve(await vault.getAddress(), 100n*10n**18n)).wait();
  await (await vault.connect(bob).deposit(100n*10n**18n)).wait();
  await assert.rejects(vault.connect(bob).activate());
  await provider.send('evm_increaseTime', [86401]); await provider.send('evm_mine', []);
  await (await vault.connect(bob).activate({gasLimit: 300000n})).wait();
  await (await token.mint(await collector.getAddress(), 10n*10n**18n)).wait();
  await (await token.connect(collector).approve(await vault.getAddress(), 10n*10n**18n)).wait();
  await (await vault.connect(collector).fundFees(10n*10n**18n)).wait();
  assert.equal(await vault.pendingReward(await bob.getAddress()), 10n*10n**18n);
  await (await vault.connect(bob).claim()).wait();
  assert.equal(await vault.pendingReward(await bob.getAddress()), 0n);
  await (await vault.connect(bob).withdraw(100n*10n**18n)).wait();
  assert.equal(await token.balanceOf(await vault.getAddress()), 0n);
  assert.equal(await vault.totalRewardsPaid(), await vault.totalFeesReceived());

  const dustVault = await deploy('RewardsVault', alice, await token.getAddress(), await alice.getAddress(), await collector.getAddress());
  for (const user of [alice,bob,collector]) {
    await (await token.mint(await user.getAddress(), 3n)).wait();
    await (await token.connect(user).approve(await dustVault.getAddress(), 3n)).wait();
    await (await dustVault.connect(user).deposit(1n)).wait();
  }
  await provider.send('evm_increaseTime', [86401]); await provider.send('evm_mine', []);
  for (const user of [alice,bob,collector]) await (await dustVault.connect(user).activate({gasLimit:300000n})).wait();
  await (await token.connect(collector).approve(await dustVault.getAddress(), 3n)).wait();
  await (await dustVault.connect(collector).fundFees(1n)).wait();
  await (await dustVault.connect(collector).fundFees(1n)).wait();
  for (const user of [alice,bob,collector]) await (await dustVault.connect(user).claim()).wait();
  assert.ok((await dustVault.totalRewardsPaid()) <= (await dustVault.totalFeesReceived()));
  assert.ok((await token.balanceOf(await dustVault.getAddress())) >= (await dustVault.totalPrincipal()));
});

test('AAPL escrow pays only its fixed recipient and prevents replay', async () => {
  const {newSecret, noteCommitment} = await import('../../packages/sdk/note.mjs');
  const provider = new ethers.BrowserProvider(ganache.provider({logging:{quiet:true}}));
  const [sender, recipient, attacker] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
  const token = await deploy('MockAAPL', sender);
  const vault = await deploy('AppleVault', sender, await token.getAddress());
  const amount = 5n*10n**18n;
  const secret = newSecret();
  const recipientAddress = await recipient.getAddress();
  const commitment = noteCommitment(secret, recipientAddress, await vault.getAddress(), (await provider.getNetwork()).chainId);
  await (await token.mint(await sender.getAddress(), amount*2n)).wait();
  await (await token.approve(await vault.getAddress(), amount*2n)).wait();
  await (await vault.deposit(amount, recipientAddress, commitment)).wait();
  assert.equal(await vault.totalLocked(), amount);
  assert.equal(await token.balanceOf(await vault.getAddress()), amount);
  await assert.rejects(vault.connect(attacker).withdraw(secret, await attacker.getAddress()));
  await (await vault.connect(attacker).withdraw(secret, recipientAddress)).wait();
  assert.equal(await token.balanceOf(recipientAddress), amount);
  assert.equal(await vault.totalLocked(), 0n);
  await assert.rejects(vault.withdraw(secret, recipientAddress));
  await assert.rejects(vault.deposit(amount, recipientAddress, commitment));

  const secondSecret = newSecret();
  const secondCommitment = noteCommitment(secondSecret, recipientAddress, await vault.getAddress(), (await provider.getNetwork()).chainId);
  await (await vault.deposit(amount, recipientAddress, secondCommitment)).wait();
  await assert.rejects(vault.reclaim(secondCommitment));
  await provider.send('evm_increaseTime', [90*86400+1]); await provider.send('evm_mine', []);
  await assert.rejects(vault.connect(attacker).reclaim(secondCommitment));
  await (await vault.reclaim(secondCommitment, {gasLimit:300000n})).wait();
  assert.equal(await vault.totalLocked(), 0n);
  assert.equal(await token.balanceOf(await vault.getAddress()), 0n);
});

test('fee escrow sends the full actual progressive fee to eligible depositors', async () => {
  const {newSecret, noteCommitment} = await import('../../packages/sdk/note.mjs');
  const provider = new ethers.BrowserProvider(ganache.provider({logging:{quiet:true}}));
  const [sender, lp, recipient] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
  const token = await deploy('MockAAPL', sender);
  const feed = await deploy('MockUsdFeed', sender);
  const feeManager = await deploy('FeeManager', sender, await token.getAddress(), await feed.getAddress(), 3600n);
  const rewards = await deploy('RewardsVault', sender, await token.getAddress(), await sender.getAddress(), await sender.getAddress());
  const vault = await deploy('AppleFeeVault', sender, await token.getAddress(), await feeManager.getAddress(), await rewards.getAddress());
  await (await rewards.setCollector(await vault.getAddress())).wait();

  const share = 10n**18n;
  await (await token.mint(await lp.getAddress(), 100n*share)).wait();
  await (await token.connect(lp).approve(await rewards.getAddress(), 100n*share)).wait();
  await (await rewards.connect(lp).deposit(100n*share)).wait();
  await provider.send('evm_increaseTime', [86401]); await provider.send('evm_mine', []);
  await (await rewards.connect(lp).activate({gasLimit:300000n})).wait();
  const current = await provider.getBlock('latest');
  await (await feed.set(100n*10n**8n, BigInt(current.timestamp))).wait();

  const amount = 20n*share;
  const expectedFee = 15n*share/100n;
  const secret = newSecret();
  const destination = await recipient.getAddress();
  const commitment = noteCommitment(secret,destination,await vault.getAddress(),(await provider.getNetwork()).chainId);
  await (await token.mint(await sender.getAddress(), amount)).wait();
  await (await token.approve(await vault.getAddress(), amount)).wait();
  await assert.rejects(vault.deposit(amount,destination,commitment,0n));
  await (await vault.deposit(amount,destination,commitment,expectedFee,{gasLimit:800000n})).wait();
  assert.equal(await vault.totalLocked(), amount-expectedFee);
  assert.equal(await token.balanceOf(await vault.getAddress()), amount-expectedFee);
  assert.equal(await rewards.totalFeesReceived(), expectedFee);
  assert.equal(await rewards.pendingReward(await lp.getAddress()), expectedFee);
  await (await vault.connect(lp).withdraw(secret,destination)).wait();
  assert.equal(await token.balanceOf(destination), amount-expectedFee);
  await (await rewards.connect(lp).claim()).wait();
  assert.equal(await rewards.totalRewardsPaid(), expectedFee);
  assert.equal(await token.balanceOf(await rewards.getAddress()), 100n*share);
});

test('V2 pool splits one deposit across independent recipients and never pauses for Earn', async () => {
  const {newSecret, noteCommitment} = await import('../../packages/sdk/note.mjs');
  const provider = new ethers.BrowserProvider(ganache.provider({logging:{quiet:true}}));
  const [sender, lp, recipientA, recipientB, relayer] = await Promise.all([0,1,2,3,4].map(i=>provider.getSigner(i)));
  const token = await deploy('MockAAPL', sender);
  const feed = await deploy('MockUsdFeed', sender);
  const current = await provider.getBlock('latest');
  await (await feed.set(100n*10n**8n, BigInt(current.timestamp))).wait();
  const feeManager = await deploy('FeeManager', sender, await token.getAddress(), await feed.getAddress(), 3600n);
  const rewards = await deploy('RewardsVaultV2', sender, await token.getAddress(), await sender.getAddress(), await sender.getAddress());
  const pool = await deploy('SplitPoolVault', sender, await token.getAddress(), await feeManager.getAddress(), await rewards.getAddress());
  await (await rewards.setCollector(await pool.getAddress())).wait();

  const share = 10n**18n;
  const one = share;
  const half = share / 2n;
  await (await token.mint(await sender.getAddress(), one)).wait();
  await (await token.approve(await pool.getAddress(), one)).wait();
  await (await pool.depositToPool(one)).wait();
  assert.equal(await pool.poolBalance(await sender.getAddress()), one);

  const secretA = newSecret();
  const secretB = newSecret();
  const destinationA = await recipientA.getAddress();
  const destinationB = await recipientB.getAddress();
  const commitmentA = noteCommitment(secretA, destinationA, await pool.getAddress(), (await provider.getNetwork()).chainId);
  const commitmentB = noteCommitment(secretB, destinationB, await pool.getAddress(), (await provider.getNetwork()).chainId);
  const quote = await feeManager.quote(half);
  const fee = quote.feeTokens;
  const net = half - fee;

  // The first note succeeds even though nobody has deposited into Earn yet.
  await (await pool.createNote(half, destinationA, commitmentA, fee)).wait();
  assert.equal(await pool.pendingFees(), fee);
  assert.equal(await pool.poolBalance(await sender.getAddress()), half);

  // Earn V2 is immediately eligible; the next note flushes both fees.
  await (await token.mint(await lp.getAddress(), 10n*share)).wait();
  await (await token.connect(lp).approve(await rewards.getAddress(), 10n*share)).wait();
  await (await rewards.connect(lp).deposit(10n*share)).wait();
  assert.equal(await rewards.eligiblePrincipal(), 10n*share);
  await (await pool.createNote(half, destinationB, commitmentB, fee)).wait();
  assert.equal(await pool.poolBalance(await sender.getAddress()), 0n);
  assert.equal(await pool.pendingFees(), 0n);
  assert.equal(await rewards.pendingReward(await lp.getAddress()), fee * 2n);

  // Either recipient or a relayer can submit a code, but each payout is fixed to its own recipient.
  await (await pool.connect(relayer).redeem(secretA, destinationA)).wait();
  await (await pool.connect(recipientB).redeem(secretB, destinationB)).wait();
  assert.equal(await token.balanceOf(destinationA), net);
  assert.equal(await token.balanceOf(destinationB), net);
  assert.equal(await pool.totalLocked(), 0n);
  await assert.rejects(pool.redeem(secretA, destinationA));
});
