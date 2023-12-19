import { ActionIcon, Button, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { BN } from '@coral-xyz/anchor';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { ProposalOrdersTable } from './ProposalOrdersTable';
import { useOpenbookTwap } from '../../hooks/useOpenbookTwap';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';

export function ProposalOrdersCard() {
  const wallet = useWallet();
  const sender = useTransactionSender();
  const {
    metaDisabled,
    usdcDisabled,
    fetchOpenOrders,
    createTokenAccounts,
    proposal,
    orders,
    markets,
  } = useProposal();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const genericOrdersHeaders = [
    'Order ID',
    'Market',
    'Status',
    'Size',
    'Price',
    'Notional',
    'Actions',
  ];

  const unsettledOrdersHeaders = ['Order ID', 'Market', 'Claimable', 'Actions'];

  const handleSettleFunds = useCallback(
    async (
      ordersToSettle: OpenOrdersAccountWithKey[],
      passMarket: boolean,
      dontClose: boolean = false,
    ) => {
      if (!proposal || !markets) return;
      let txs;
      if (!dontClose) {
        txs = (
          await Promise.all(
            ordersToSettle.map((order) =>
              settleFundsTransactions(
                new BN(order.account.accountNum),
                passMarket,
                proposal,
                proposal.account.openbookPassMarket.equals(order.account.market)
                  ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
                  : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
              ).then((settleTx) =>
                closeOpenOrdersAccountTransactions(new BN(order.account.accountNum)).then(
                  (closeTx) =>
                    settleTx && closeTx ? new Transaction().add(...settleTx, ...closeTx) : null,
                ),
              ),
            ),
          )
        )
          .flat()
          .filter(Boolean);
      } else {
        txs = (
          await Promise.all(
            ordersToSettle.map((order) =>
              settleFundsTransactions(
                new BN(order.account.accountNum),
                passMarket,
                proposal,
                proposal.account.openbookPassMarket.equals(order.account.market)
                  ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
                  : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
              ),
            ),
          )
        )
          .flat()
          .filter(Boolean);
      }

      if (!wallet.publicKey || !txs) return;

      try {
        setIsSettling(true);
        await sender.send(txs.filter(Boolean) as Transaction[], true);
        await fetchOpenOrders(wallet.publicKey!);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSettling(false);
      }
    },
    [proposal, settleFundsTransactions, fetchOpenOrders, sender],
  );

  if (!orders || !markets) return <></>;

  const filterEmptyOrders = (): OpenOrdersAccountWithKey[] =>
    orders.filter((order) => {
      if (order.account.openOrders[0].isFree === 1) {
        return order;
      }
      return null;
    });

  const unsettledOrdersDescription = () => (
    <Stack>
      <Text size="sm">
        These are your Order Accounts (OpenBook uses a{' '}
        <a
          href="https://twitter.com/openbookdex/status/1727309884159299929?s=61&t=Wv1hCdAly84RMB_iLO0iIQ"
          target="_blank"
          rel="noreferrer"
        >
          crank
        </a>{' '}
        and to do that when you place an order you create an account for that order). If you see a
        balance here you can settle the balance (to have it returned to your wallet for futher use
        while the proposal is active). Once settled, you can close the account to reclaim the SOL.
        <br />
        <br />
        If you&apos;re unable to settle your account, you may not have a token account for the
        respective pass / fail tokens. Use the buttons below to create the conditional token
        accounts.
      </Text>
      <Group>
        <Button disabled={metaDisabled} onClick={() => createTokenAccounts(true)}>
          Conditional META
        </Button>
        <Button disabled={usdcDisabled} onClick={() => createTokenAccounts(false)}>
          Conditional USDC
        </Button>
      </Group>
      <Group justify="flex-end">
        <Button
          loading={isSettling}
          onClick={() =>
            proposal &&
            handleSettleFunds(
              filterEmptyOrders(),
              proposal.account.openbookFailMarket.equals(markets.passTwap.market),
            )
          }
          disabled={filterEmptyOrders().length === 0 || false}
        >
          Settle And Close All Orders
        </Button>
      </Group>
    </Stack>
  );

  // const filterPartiallyFilledOrders = (): OpenOrdersAccountWithKey[] =>
  //   orders.filter((order) => {
  //     if (order.account.openOrders[0].isFree === 0) {
  //       if (order.account.position.baseFreeNative.toNumber() > 0) {
  //         return order;
  //       }
  //       if (order.account.position.quoteFreeNative.toNumber() > 0) {
  //         return order;
  //       }
  //       return null;
  //     }
  //     return null;
  //   });

  const filterOpenOrders = (): OpenOrdersAccountWithKey[] =>
    orders.filter((order) => {
      if (order.account.openOrders[0].isFree === 0) {
        const passAsksFilter = markets.passAsks.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const passBidsFilter = markets.passBids.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const failAsksFilter = markets.failAsks.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const failBidsFilter = markets.failBids.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        let _order = null;
        if (failAsksFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = failAsksFilter[0];
        }
        if (failBidsFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = failBidsFilter[0];
        }
        if (passAsksFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = passAsksFilter[0];
        }
        if (passBidsFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = passBidsFilter[0];
        }
        if (_order !== null) {
          return order;
        }
        return null;
      }
      return null;
    });

  const filterCompletedOrders = (): OpenOrdersAccountWithKey[] => {
    const openOrders = filterOpenOrders();
    const emptyAccounts = filterEmptyOrders();
    let filteredOrders = orders;
    if (openOrders.length > 0) {
      const openOrderKeys = openOrders.map((_order) => _order.publicKey.toString());
      filteredOrders = orders.filter(
        (order) => !openOrderKeys.includes(order.publicKey.toString()),
      );
    }
    if (emptyAccounts.length > 0) {
      const emptyAccountKeys = emptyAccounts.map((_order) => _order.publicKey.toString());
      filteredOrders = filteredOrders.filter(
        (order) => !emptyAccountKeys.includes(order.publicKey.toString()),
      );
    }
    if (emptyAccounts.length > 0 || openOrders.length > 0) {
      return filteredOrders.filter((elem, index, self) => index === self.indexOf(elem));
    }
    return [];
  };

  return !proposal || !markets || !orders ? (
    <Group justify="center" w="100%" h="100%">
      <Loader />
    </Group>
  ) : (
    <>
      <Group justify="space-between" align="center">
        <Group>
          <Text fw="bolder" size="xl">
            Orders
          </Text>
          <ActionIcon
            variant="subtle"
            // @ts-ignore
            onClick={() => fetchOpenOrders(proposal, wallet.publicKey)}
          >
            <IconRefresh />
          </ActionIcon>
        </Group>
      </Group>
      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <ProposalOrdersTable
            description="If you see orders here with a settle button, you can settle them to redeem the partial fill amount. These exist
            when there is a balance available within the Open Orders Account."
            headers={genericOrdersHeaders}
            orders={filterOpenOrders()}
            orderStatus="open"
            settleOrders={handleSettleFunds}
          />
        </Tabs.Panel>
        <Tabs.Panel value="uncranked">
          <ProposalOrdersTable
            description=" If you see orders here, you can use the cycle icon with the 12 on it next to the
            respective market which will crank it and push the orders into the Unsettled, Open
            Accounts below."
            headers={genericOrdersHeaders}
            orders={filterCompletedOrders()}
            orderStatus="uncranked"
            settleOrders={handleSettleFunds}
          />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <ProposalOrdersTable
            description={unsettledOrdersDescription()}
            headers={unsettledOrdersHeaders}
            orders={filterEmptyOrders()}
            orderStatus="closed"
            settleOrders={handleSettleFunds}
          />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
