'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { ProposalDetailCard } from '@/components/Proposals/ProposalDetailCard';
import { ProposalProvider } from '@/contexts/ProposalContext';

export default function ProposalsPage() {
  const params = useSearchParams();
  const proposalNumber = Number(params.get('id'));

  return (
    <Layout>
      <ProposalProvider proposalNumber={proposalNumber}>
        <ProposalDetailCard />
      </ProposalProvider>
    </Layout>
  );
}
