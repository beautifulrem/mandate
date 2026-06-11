'use client';

import './serverLocalStorage';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { RPC_URL } from './config';

// MetaMask-ONLY wallet setup (no WalletConnect Cloud projectId needed).
// RainbowKit + EIP-6963 rdns discovery pin the connect modal to the REAL MetaMask
// extension — no generic injected fallback, so Phantom/other injectors can never
// hijack the flow (the demo's smart account must be the MetaMask one). The projectId
// is a placeholder; WalletConnect (QR/mobile) is intentionally not wired for this demo.
const connectors = connectorsForWallets(
  [{ groupName: 'MetaMask', wallets: [metaMaskWallet] }],
  { appName: 'Mandate', projectId: 'mandate-injected-demo' },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(RPC_URL),
    [base.id]: http(),
  },
  // OFF: wagmi's EIP-6963 auto-discovery would add a connector for EVERY announced wallet
  // (Phantom, …) and RainbowKit lists those under "Installed" regardless of the wallet list
  // above. metaMaskWallet does its own rdns-targeted detection, so MetaMask still connects.
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
