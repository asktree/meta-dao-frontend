'use client';

import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { notifications } from '@mantine/notifications';
import * as token from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { useProvider } from '@/hooks/useProvider';
import { useTokens } from '../../hooks/useTokens';

export default function CreateTestTokensCard() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const provider = useProvider();
  const { tokens, setTokens } = useTokens();





  const handleCreateDao = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return;

    const txMeta = new Transaction();
    
    const mintAuthorityKeypair = Keypair.fromSecretKey(Uint8Array.from([48,251,52,175,239,174,173,222,122,205,222,68,183,155,149,6,244,35,133,69,48,235,6,193,63,35,28,46,26,216,255,201,46,2,39,167,85,2,3,7,218,22,224,17,17,165,227,69,73,227,126,17,85,169,191,122,13,177,148,134,173,196,83,152]))
    const metaAccount = token.getAssociatedTokenAddressSync(
      tokens.meta!.publicKey,
      wallet.publicKey,
    );
    txMeta.add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        metaAccount,
        wallet.publicKey,
        tokens.meta!.publicKey,
        ),
    );
    txMeta.add(
      token.createMintToInstruction(
        tokens.meta!.publicKey,
        metaAccount,
        mintAuthorityKeypair.publicKey,
        100000n * BigInt(LAMPORTS_PER_SOL),
      ),
    );

    const txUsdc = new Transaction();
    
    const quoteAccount = token.getAssociatedTokenAddressSync(
      tokens.usdc!.publicKey,
      wallet.publicKey,
    );
    txUsdc.add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        quoteAccount,
        wallet.publicKey,
        tokens.usdc!.publicKey,
        ),
    );
    txUsdc.add(
      token.createMintToInstruction(
        tokens.usdc!.publicKey,
        quoteAccount,
        mintAuthorityKeypair.publicKey,
        100000n * BigInt(LAMPORTS_PER_SOL),
      ),
    );

    const blockhash = await provider.connection.getLatestBlockhash('confirmed');
    txMeta.recentBlockhash = blockhash.blockhash;
    txMeta.lastValidBlockHeight = blockhash.lastValidBlockHeight;
    txMeta.feePayer = wallet.publicKey;
    txMeta.sign(mintAuthorityKeypair);

    txUsdc.recentBlockhash = blockhash.blockhash;
    txUsdc.lastValidBlockHeight = blockhash.lastValidBlockHeight;
    txUsdc.feePayer = wallet.publicKey;
    txUsdc.sign(mintAuthorityKeypair);

    const signedTxs = await wallet.signAllTransactions([txMeta, txUsdc]);
    await Promise.all(signedTxs.map((tx) => connection.sendRawTransaction(tx.serialize(), {skipPreflight: true})));

    notifications.show({
      message: 'Created Test $META and Test $USDC',
      title: 'Successfully minted',
      color: 'green',
    });
   
  }, [provider, wallet, connection]);

  return (
    <Card shadow="sm" radius="md" withBorder>
      <Card.Section>
        <Stack gap="15" p="xs">
          {tokens?.meta ? (
            <Text>Meta mint: {tokens.meta.publicKey.toString()}</Text>
          ) : (
            <Text>No meta token yet</Text>
          )}
          {tokens?.usdc ? (
            <Text>Usdc mint: {tokens.usdc.publicKey.toString()}</Text>
          ) : (
            <Text>No usdc token yet</Text>
          )}
        </Stack>
      </Card.Section>
      <Card.Section>
        <Group p="sm">
          <Button fullWidth onClick={() => handleCreateDao()}>
            Create test tokens
          </Button>
        </Group>
      </Card.Section>
    </Card>
  );
}
