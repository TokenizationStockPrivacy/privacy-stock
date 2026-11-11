'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useConnection, useDeployContract, usePublicClient, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import type { Abi, Address, Hash, Hex } from 'viem';
import rewardsArtifact from '../lib/artifacts/RewardsVaultV2.json';
import poolArtifact from '../lib/artifacts/SplitPoolVault.json';
import { AAPLC_TOKEN, FEE_MANAGER, basescanAddress, basescanTx } from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { waitConfirmed } from '../lib/tx';
import { WalletButton } from './WalletButton';

type Deployment = {
  rewardsAddress?: Address;
  rewardsTx?: Hash;
  poolAddress?: Address;
  poolTx?: Hash;
  collectorTx?: Hash;
};

const STORAGE_KEY = 'privacy-stock-v2-deployment';

export function DeployV2() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: deployAsync } = useDeployContract();
  const { mutateAsync: writeAsync } = useWriteContract();
  const [deployment, setDeployment] = useState<Deployment>({});
  const [busy, setBusy] = useState<'rewards' | 'pool' | 'collector' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDeployment(JSON.parse(saved) as Deployment);
    } catch {
      // The page still works when storage is unavailable; the results simply will not survive a reload.
    }
  }, []);

  function save(next: Deployment) {
    setDeployment(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional persistence */ }
  }

  async function deployRewards() {
    if (!address || !publicClient) return;
    setBusy('rewards'); setError(''); setStatus('Confirm the RewardsVaultV2 deployment in your wallet.');
    try {
      const hash = await deployAsync({
        abi: rewardsArtifact.abi as Abi,
        bytecode: rewardsArtifact.bytecode as Hex,
        args: [AAPLC_TOKEN, address, address],
        chainId: base.id,
      });
      setStatus('RewardsVaultV2 is pending on Base mainnet.');
      const receipt = await waitConfirmed(publicClient, hash, 'RewardsVaultV2 deployment');
      if (!receipt.contractAddress) throw new Error('Base confirmed the deployment but did not return a contract address.');
      save({ ...deployment, rewardsAddress: receipt.contractAddress, rewardsTx: hash });
      setStatus('RewardsVaultV2 confirmed. Continue with the split pool.');
    } catch (e) { setError(friendlyError(e)); setStatus(''); }
    finally { setBusy(''); }
  }

  async function deployPool() {
    if (!deployment.rewardsAddress || !publicClient) return;
    setBusy('pool'); setError(''); setStatus('Confirm the SplitPoolVault deployment in your wallet.');
    try {
      const hash = await deployAsync({
        abi: poolArtifact.abi as Abi,
        bytecode: poolArtifact.bytecode as Hex,
        args: [AAPLC_TOKEN, FEE_MANAGER, deployment.rewardsAddress],
        chainId: base.id,
      });
      setStatus('SplitPoolVault is pending on Base mainnet.');
      const receipt = await waitConfirmed(publicClient, hash, 'SplitPoolVault deployment');
      if (!receipt.contractAddress) throw new Error('Base confirmed the deployment but did not return a contract address.');
      save({ ...deployment, poolAddress: receipt.contractAddress, poolTx: hash });
      setStatus('SplitPoolVault confirmed. Assign it as the reward fee collector.');
    } catch (e) { setError(friendlyError(e)); setStatus(''); }
    finally { setBusy(''); }
  }

  async function assignCollector() {
    if (!deployment.rewardsAddress || !deployment.poolAddress || !publicClient) return;
    setBusy('collector'); setError(''); setStatus('Confirm the collector assignment in your wallet.');
    try {
      const hash = await writeAsync({
        address: deployment.rewardsAddress,
        abi: rewardsArtifact.abi as Abi,
        functionName: 'setCollector',
        args: [deployment.poolAddress],
        chainId: base.id,
      });
      setStatus('Collector assignment is pending on Base mainnet.');
      await waitConfirmed(publicClient, hash, 'Collector assignment');
      save({ ...deployment, collectorTx: hash });
      setStatus('V2 deployment is complete. Copy the results below.');
    } catch (e) { setError(friendlyError(e)); setStatus(''); }
    finally { setBusy(''); }
  }

  const onBase = chainId === base.id;
  const ready = !!deployment.rewardsAddress && !!deployment.poolAddress && !!deployment.collectorTx;

  return (
    <main id="main" className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <a href="/" className="eyebrow">Privacy Stock</a>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deploy split pool V2</h1>
        </div>
        <WalletButton />
      </header>

      <section className="mt-8 rounded-xl border border-warn/40 bg-warn-bg p-4 text-sm">
        <strong>Base mainnet · real gas · unaudited contracts.</strong> V2 lets one pool balance create many independent notes. A 0.5 AAPLc note deducts its fee from that 0.5 amount. Transactions never pause while Earn is empty; fees wait in the pool until an Earn position exists.
      </section>

      <ol className="mt-8 grid gap-4">
        <DeployStep n="1" title="RewardsVaultV2" description="Earn deposits become eligible immediately." address={deployment.rewardsAddress} hash={deployment.rewardsTx}>
          <button className="btn btn-primary" type="button" disabled={!isConnected || !onBase || !!busy || !!deployment.rewardsAddress} onClick={deployRewards}>
            {busy === 'rewards' ? 'Deploying…' : deployment.rewardsAddress ? 'Confirmed' : 'Deploy RewardsVaultV2'}
          </button>
        </DeployStep>
        <DeployStep n="2" title="SplitPoolVault" description="Deposit once, then create multiple recipient/code notes." address={deployment.poolAddress} hash={deployment.poolTx}>
          <button className="btn btn-primary" type="button" disabled={!deployment.rewardsAddress || !!busy || !!deployment.poolAddress} onClick={deployPool}>
            {busy === 'pool' ? 'Deploying…' : deployment.poolAddress ? 'Confirmed' : 'Deploy SplitPoolVault'}
          </button>
        </DeployStep>
        <DeployStep n="3" title="Assign fee collector" description="Allows the split pool to send 100% of collected fees to Earn." hash={deployment.collectorTx}>
          <button className="btn btn-primary" type="button" disabled={!deployment.poolAddress || !!busy || !!deployment.collectorTx} onClick={assignCollector}>
            {busy === 'collector' ? 'Assigning…' : deployment.collectorTx ? 'Confirmed' : 'Assign collector'}
          </button>
        </DeployStep>
      </ol>

      {!isConnected && <p className="mt-6 text-sm text-muted">Connect the deployment wallet to begin.</p>}
      {isConnected && !onBase && <p className="mt-6 text-sm text-warn">Switch the wallet to Base mainnet.</p>}
      {status && <p role="status" className="mt-6 rounded-lg border border-line bg-surface-2 p-4 text-sm">{status}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error}</p>}

      {ready && (
        <section className="mt-8 card">
          <h2 className="text-xl font-semibold">Deployment complete</h2>
          <p className="mt-2 text-sm text-muted">Send these two addresses back so the public app can be switched to V2.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg p-4 text-xs">{JSON.stringify(deployment, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

function DeployStep({ n, title, description, address, hash, children }: {
  n: string; title: string; description: string; address?: Address; hash?: Hash; children: ReactNode;
}) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step {n}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
          {address && <a className="link mt-3 block break-all font-mono text-xs" href={basescanAddress(address)} target="_blank" rel="noreferrer">{address}</a>}
          {hash && <a className="link mt-2 block font-mono text-xs" href={basescanTx(hash)} target="_blank" rel="noreferrer">Transaction {hash.slice(0, 12)}…</a>}
        </div>
        {children}
      </div>
    </li>
  );
}
