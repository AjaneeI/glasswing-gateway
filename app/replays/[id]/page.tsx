import { GatewayReplay } from '@/components/gateway/replay';
import { ReplayPage } from '@/components/sessions/replay-page';
import { sessions } from '@/lib/mock-data/sessions';
import { notFound } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const demo = sessions.find((session) => session.id === id);
  if (demo)
    return (
      <>
        <div className="info-panel">
          Demo replay — illustrative storefront actions, not a recorded Gateway scan.
        </div>
        <ReplayPage session={demo} />
      </>
    );
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <GatewayReplay id={id} />;
}
