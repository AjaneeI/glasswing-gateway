import { Button } from '@/components/ui/primitives';
import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>This page isn’t in your workspace.</h1>
      <p>Return to the overview to continue exploring Gateway.</p>
      <Button asChild>
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
