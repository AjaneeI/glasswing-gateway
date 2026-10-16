'use client';
import { Card, CardHeader, Select } from '@/components/ui/primitives';
import { previewPages, scanIssues } from '@/lib/mock-data/scans';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  Mountain,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
export function IssueAnnotation({
  number,
  label,
  selected,
  onClick,
  className,
}: {
  number: number;
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={cn('issue-annotation', selected && 'selected', className)}
      onClick={onClick}
      aria-label={`Issue ${number}: ${label}`}
      aria-pressed={selected}
    >
      <span>{number}</span>
      <strong>{label}</strong>
    </button>
  );
}
export function BrowserPreview({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (id: number) => void;
}) {
  const [page, setPage] = useState('Product page');
  const [color, setColor] = useState('Forest');
  const [capacity, setCapacity] = useState('45L');
  const [added, setAdded] = useState(false);
  return (
    <Card className="site-analysis">
      <CardHeader
        title="Site analysis preview"
        subtitle="See your storefront through an autonomous shopper’s lens."
        action={
          <Select label="Preview page" value={page} onChange={setPage} options={previewPages} />
        }
      />
      <div className="browser-preview-wrap">
        <div className="browser-frame">
          <div className="browser-toolbar">
            <div className="browser-dots">
              <i />
              <i />
              <i />
            </div>
            <span>
              <LockKeyhole size={10} />
              evertrailoutdoors.com
              {page === 'Product page'
                ? '/products/summit-trail-45l'
                : page === 'Shipping policy'
                  ? '/policies/shipping'
                  : `/${page.toLowerCase()}`}
            </span>
            <RotateCcw size={11} />
          </div>
          <div className="store-nav">
            <span className="store-logo">
              <Mountain size={21} />
              <span>
                EVERTRAIL<small>OUTDOORS</small>
              </span>
            </span>
            <span className="store-nav-links">
              Shop
              <ChevronDown size={9} />
              Our story
            </span>
            <Search size={12} />
            <ShoppingBag size={12} />
          </div>
          {page === 'Product page' ? (
            <>
              <div className="store-breadcrumb">
                Shop
                <ChevronRight size={9} />
                Backpacks
                <ChevronRight size={9} />
                <span>Summit Trail 45L</span>
              </div>
              <div className="product-preview">
                <div className="product-photo-wrap">
                  <div className="product-photo">
                    <img src="/illustrations/backpack.svg" alt="Hiking backpack illustration" />
                    <span className="product-tag">BESTSELLER</span>
                    <IssueAnnotation
                      number={selected}
                      label={
                        scanIssues.find((issue) => issue.id === selected)?.title || 'Issue detected'
                      }
                      selected
                      onClick={() => onSelect(selected)}
                    />
                  </div>
                  <div className="product-thumbnails">
                    {['Front', 'Detail', 'Back'].map((label, i) => (
                      <button
                        key={label}
                        aria-label={`${label} product view`}
                        onClick={(e) => {
                          e.currentTarget.parentElement
                            ?.querySelectorAll('button')
                            .forEach((el) => el.classList.remove('active'));
                          e.currentTarget.classList.add('active');
                        }}
                        className={i === 0 ? 'active' : ''}
                      >
                        <img
                          src="/illustrations/backpack.svg"
                          alt={label}
                          style={{
                            objectPosition: `${i * 40}% center`,
                            transform: i === 1 ? 'scale(1.5)' : undefined,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="product-image-caption">
                    <ShieldCheck size={11} />
                    Built for the long way home.
                  </div>
                </div>
                <div className="product-information">
                  <span className="product-eyebrow">MULTI-DAY ADVENTURE</span>
                  <h3>
                    Summit Trail
                    <br />
                    45L Backpack
                  </h3>
                  <div className="product-stars">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={10} fill="currentColor" />
                    ))}
                    <span>4.9 (128 reviews)</span>
                  </div>
                  <div className="product-price">
                    $199.00<span>Free shipping</span>
                  </div>
                  <p>
                    Go further. A versatile, all-weather pack for weekend escapes and multi-day
                    trails.
                  </p>
                  <div
                    className={cn('product-variant-section', selected === 1 && 'issue-highlight')}
                  >
                    <label>
                      Color <span>— {color}</span>
                    </label>
                    <div className="color-swatches">
                      {[
                        { name: 'Forest', color: '#4d5c43' },
                        { name: 'Charcoal', color: '#41464a' },
                        { name: 'Sand', color: '#baa892' },
                      ].map((c) => (
                        <button
                          key={c.name}
                          onClick={() => setColor(c.name)}
                          aria-label={`Select ${c.name} color`}
                          className={cn(color === c.name && 'selected')}
                          style={{ background: c.color }}
                        >
                          {color === c.name && <Check size={11} />}
                        </button>
                      ))}
                    </div>
                    <button
                      className="issue-marker marker-one"
                      onClick={() => onSelect(1)}
                      aria-label="Issue 1: Missing structured variant data"
                    >
                      1
                    </button>
                  </div>
                  <div className={cn('capacity-section', selected === 4 && 'issue-highlight')}>
                    <label>Capacity</label>
                    <div className="capacity-options">
                      {['35L', '45L', '55L'].map((c) => (
                        <button
                          key={c}
                          className={cn(capacity === c && 'selected')}
                          onClick={() => setCapacity(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <button
                      className="issue-marker marker-four"
                      onClick={() => onSelect(4)}
                      aria-label="Issue 4: Capacity selection ambiguity"
                    >
                      4
                    </button>
                  </div>
                  <button className="store-add-to-cart" onClick={() => setAdded(true)}>
                    {added ? (
                      <>
                        <Check size={12} />
                        Added to cart
                      </>
                    ) : (
                      <>
                        Add to cart
                        <ShoppingBag size={12} />
                      </>
                    )}
                  </button>
                  <div className={cn('product-policy', selected === 2 && 'issue-highlight')}>
                    <Truck size={15} />
                    <div>
                      <strong>Free shipping on orders $100+</strong>
                      <span>Arrives in 3–5 business days</span>
                    </div>
                    <button
                      className="issue-marker"
                      onClick={() => onSelect(2)}
                      aria-label="Issue 2: Unclear shipping estimate"
                    >
                      2
                    </button>
                  </div>
                  <div className={cn('product-policy', selected === 3 && 'issue-highlight')}>
                    <RotateCcw size={14} />
                    <div>
                      <strong>30-day returns</strong>
                      <span>Adventure with confidence. See policy.</span>
                    </div>
                    <button
                      className="issue-marker"
                      onClick={() => onSelect(3)}
                      aria-label="Issue 3: Returns policy missing metadata"
                    >
                      3
                    </button>
                  </div>
                </div>
              </div>
              <div className="product-detail-footer">
                <strong>Made for every mile.</strong>
                <span>Weather-resistant ripstop · Adjustable suspension · 1.4 kg</span>
              </div>
            </>
          ) : page === 'Shipping policy' ? (
            <div className="alternative-preview">
              <span className="product-eyebrow">THE DETAILS</span>
              <h3>Shipping & returns</h3>
              <p>
                Complimentary shipping on all orders over $100. Your next adventure is 3–5 business
                days away.
              </p>
              <IssueAnnotation
                number={2}
                label="Estimate not validated against destination"
                selected={selected === 2}
                onClick={() => onSelect(2)}
              />
              <h4>Returns made simple</h4>
              <p>Return unused gear within 30 days. Some product exclusions apply.</p>
              <IssueAnnotation
                number={3}
                label="Return policy not exposed in machine-readable format"
                selected={selected === 3}
                onClick={() => onSelect(3)}
              />
            </div>
          ) : (
            <div className="alternative-preview">
              <span className="product-eyebrow">
                {page === 'Cart' ? 'YOUR NEXT ADVENTURE' : 'SECURE CHECKOUT'}
              </span>
              <h3>{page === 'Cart' ? 'Your cart' : 'Order summary'}</h3>
              <div className="cart-preview-item">
                <img src="/illustrations/backpack.svg" alt="Summit Trail backpack illustration" />
                <div>
                  <strong>Summit Trail 45L Backpack</strong>
                  <p>Forest · 45L · Qty 1</p>
                </div>
                <strong>$199.00</strong>
              </div>
              <div className="preview-total">
                <span>Shipping</span>
                <strong>Free</strong>
              </div>
              <div className="preview-total">
                <span>Estimated tax</span>
                <strong>$15.92</strong>
              </div>
              <div className="preview-total">
                <strong>Total</strong>
                <strong>$214.92</strong>
              </div>
              <IssueAnnotation
                number={4}
                label="No explicit agent checkout confirmation"
                selected={selected === 4}
                onClick={() => onSelect(4)}
              />
              <button
                className="store-add-to-cart"
                onClick={() => (page === 'Cart' ? setPage('Checkout') : onSelect(4))}
              >
                {page === 'Cart' ? 'Continue to checkout' : 'Inspect order confirmation'}
                <ArrowRight size={12} />
              </button>
            </div>
          )}
          <div className="store-footer">
            <Mountain size={12} />
            EVERTRAIL OUTDOORS<span>Get out there.</span>
          </div>
        </div>
      </div>
      <div className="selected-issue">
        <span className="issue-number">{selected}</span>
        <div>
          <strong>{scanIssues.find((i) => i.id === selected)?.title}</strong>
          <p>{scanIssues.find((i) => i.id === selected)?.description}</p>
        </div>
      </div>
      <div className="browser-annotation-legend">
        <span>
          <i />
          Issue detected
        </span>
        <span>Click a numbered marker to inspect</span>
        <span className="mono">Snapshot · SCN-0025</span>
      </div>
    </Card>
  );
}
