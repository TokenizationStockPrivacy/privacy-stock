'use client';
import { useEffect, useState } from 'react';
import { useConnection, useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { basescanAddress } from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { shortAddress } from '../lib/format';

/**
 * Wallet connection with explicit states:
 * not connected, wrong network, connected on Base.
 * Connectors come from EIP-6963 discovery, so the list shows wallets actually installed in this browser.
 */
export function WalletButton() {
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending: connecting } = useConnect();
  const { mutateAsync: disconnectAsync } = useDisconnect();
  const { mutateAsync: switchAsync, isPending: switching } = useSwitchChain();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const onBase = chainId === base.id;

  useEffect(() => {
    if (!dialogOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDialogOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [dialogOpen]);

  async function connect(connectorId: string) {
    setError('');
    const connector = connectors.find((c) => c.uid === connectorId);
    if (!connector) {
      setError('That wallet is no longer available. Reload the page and try again.');
      return;
    }
    try {
      await connectAsync({ connector });
      setDialogOpen(false);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function switchToBase() {
    setError('');
    try {
      await switchAsync({ chainId: base.id });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (!isConnected || !address) {
    return (
      <>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setDialogOpen(true);
          }}
        >
          Connect wallet
        </button>
        {dialogOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDialogOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-dialog-title"
              className="modal"
            >
              <div className="modal-body">
            <h2 id="wallet-dialog-title" className="text-lg font-semibold">Connect a wallet</h2>
            <p className="mt-1 text-sm text-muted">
              Use a wallet that supports Base. Privacy Stock never asks for your seed phrase or private key.
            </p>
            {connectors.length === 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-surface-2 p-4 text-sm text-muted" role="status">
                No browser wallet was detected. Install a wallet extension that supports Base, then reload this page.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2" aria-label="Available wallets">
                {connectors.map((c) => (
                  <li key={c.uid}>
                    <button
                      type="button"
                      className="wallet-option"
                      disabled={connecting}
                      onClick={() => connect(c.uid)}
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-muted">{connecting ? 'Waiting for wallet…' : 'Connect'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
                <div className="mt-6 flex justify-end">
                  <button type="button" className="btn btn-ghost" onClick={() => setDialogOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!onBase) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" className="btn btn-warn" onClick={switchToBase} disabled={switching}>
          {switching ? 'Switching…' : 'Switch to Base'}
        </button>
        {error && <p role="alert" className="max-w-xs text-right text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        className="wallet-chip"
        href={basescanAddress(address)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Connected as ${address}. Open in BaseScan.`}
      >
        <span className="status-dot" aria-hidden="true" />
        {shortAddress(address)}
      </a>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => disconnectAsync({})}
      >
        Disconnect
      </button>
    </div>
  );
}
