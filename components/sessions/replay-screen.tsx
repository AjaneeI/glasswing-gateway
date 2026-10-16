'use client';
import { StatusBadge } from '@/components/ui/primitives';
import type { SessionEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  CheckCheck,
  Compass,
  CreditCard,
  GitCompareArrows,
  LockKeyhole,
  Mountain,
  RotateCcw,
  ShoppingBag,
  Tag,
  Target,
} from 'lucide-react';

type Scene = 'home' | 'browse' | 'compare' | 'cart' | 'checkout' | 'complete';

const sceneByType: Record<SessionEvent['type'], Scene> = {
  goal: 'home',
  browse: 'browse',
  compare: 'compare',
  warning: 'compare',
  cart: 'cart',
  promo: 'cart',
  checkout: 'checkout',
  complete: 'complete',
};

const scenePath: Record<Scene, string> = {
  home: '/',
  browse: '/collections/backpacks',
  compare: '/products/summit-trail-45l',
  cart: '/cart',
  checkout: '/checkout',
  complete: '/checkout/confirmation',
};

const eventIcons = {
  goal: Target,
  browse: Compass,
  compare: GitCompareArrows,
  warning: Tag,
  cart: ShoppingBag,
  promo: Tag,
  checkout: CreditCard,
  complete: CheckCheck,
};

/**
 * The recreation approach: rather than the agent capturing real screen video
 * (which it isn't built to do), each SessionEvent's `type` maps onto one of a
 * handful of storefront "scenes" reusing the same mock storefront chrome as
 * /scan's BrowserPreview. Advancing `event` re-renders the matching scene, so
 * scrubbing through a session's timeline looks like watching the agent move
 * through the site.
 */
export function ReplayScreen({ event }: { event: SessionEvent }) {
  const scene = sceneByType[event.type];
  const Icon = eventIcons[event.type];
  return (
    <div className="replay-screen">
      <div className="browser-frame">
        <div className="browser-toolbar">
          <div className="browser-dots">
            <i />
            <i />
            <i />
          </div>
          <span>
            <LockKeyhole size={10} />
            evertrailoutdoors.com{scenePath[scene]}
          </span>
          <RotateCcw size={11} />
        </div>
        <div className="store-nav">
          <span className="store-logo">
            <Mountain size={19} />
            <span>
              EVERTRAIL<small>OUTDOORS</small>
            </span>
          </span>
          <span className="store-nav-links">Shop</span>
        </div>
        <div className="replay-scene">
          {scene === 'home' && <HomeScene />}
          {scene === 'browse' && <BrowseScene highlight={event.type === 'browse'} />}
          {scene === 'compare' && <CompareScene warning={event.type === 'warning'} />}
          {scene === 'cart' && <CartScene rejected={event.type === 'promo'} />}
          {scene === 'checkout' && <CheckoutScene />}
          {scene === 'complete' && <CompleteScene />}
        </div>
      </div>
      <div className={cn('replay-scene-caption', event.type === 'warning' && 'warning')}>
        <span className="replay-scene-icon">
          <Icon size={13} />
        </span>
        <span>
          <strong>{event.title}</strong>
          <small>{event.summary}</small>
        </span>
        {event.status && <StatusBadge dot={false}>{event.status}</StatusBadge>}
      </div>
    </div>
  );
}
function HomeScene() {
  return (
    <div className="replay-scene-body">
      <div className="replay-hero">
        <span>MADE FOR THE WAY OUT</span>
        <strong>Gear built for the long way home.</strong>
      </div>
      <div className="replay-category-row">
        {['Backpacks', 'Tents', 'Footwear'].map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
    </div>
  );
}
function BrowseScene({ highlight }: { highlight: boolean }) {
  return (
    <div className="replay-scene-body">
      <div className="replay-product-grid">
        {[
          { name: 'Trailhead 28', price: '$129' },
          { name: 'Summit Trail 45L', price: '$199' },
          { name: 'Alpine Pro 55', price: '$259' },
        ].map((p) => (
          <div key={p.name} className={cn(p.name === 'Summit Trail 45L' && highlight && 'active')}>
            <span className="replay-product-photo" />
            <strong>{p.name}</strong>
            <span>{p.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function CompareScene({ warning }: { warning: boolean }) {
  return (
    <div className="replay-scene-body">
      <div className="replay-product-detail">
        <span className="replay-product-photo large" />
        <div>
          <strong>Summit Trail 45L Backpack</strong>
          <span>$199.00 · Forest · 45L</span>
          <div className={cn('replay-policy-line', warning && 'warning')}>
            <span>Free shipping · Arrives in 3–5 business days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function CartScene({ rejected }: { rejected: boolean }) {
  return (
    <div className="replay-scene-body">
      <div className="replay-cart-line">
        <span className="replay-product-photo" />
        <div>
          <strong>Summit Trail 45L Backpack</strong>
          <span>Forest · 45L · Qty 1</span>
        </div>
        <strong>$199.00</strong>
      </div>
      {rejected && (
        <div className="replay-policy-line warning">
          <span>Promo code WELCOME10 rejected · limit reached</span>
        </div>
      )}
    </div>
  );
}
function CheckoutScene() {
  return (
    <div className="replay-scene-body">
      <div className="replay-order-summary">
        <div>
          <span>Subtotal</span>
          <span>$199.00</span>
        </div>
        <div>
          <span>Shipping</span>
          <span>Free</span>
        </div>
        <div>
          <span>Estimated tax</span>
          <span>$15.92</span>
        </div>
        <div className="replay-order-total">
          <span>Total</span>
          <span>$214.92</span>
        </div>
      </div>
    </div>
  );
}
function CompleteScene() {
  return (
    <div className="replay-scene-body replay-complete-scene">
      <CheckCheck size={28} />
      <strong>Order simulation completed</strong>
      <span>No live order was placed.</span>
    </div>
  );
}
