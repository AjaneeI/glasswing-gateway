'use client';
import type { Severity } from '@/lib/types';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowRight, Check, ChevronDown, Inbox, Loader2, X } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: 'btn-primary',
      outline: 'btn-outline',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    },
    size: { default: '', sm: 'btn-sm', icon: 'btn-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}
export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2>
          {icon}
          {title}
        </h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatusBadge({
  children,
  tone,
  dot = true,
}: {
  children: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
  dot?: boolean;
}) {
  const label = String(children);
  const inferred =
    tone ||
    (/Good|Completed|Verified|Allowed|Enabled|Connected|Configured|Success|ready|Within|Resolved/.test(
      label,
    )
      ? 'green'
      : /Failed|Blocked|Critical/.test(label)
        ? 'red'
        : /Needs|Warning|Limited|confirmation|Pending/.test(label)
          ? 'amber'
          : 'neutral');
  return (
    <span className={`badge badge-${inferred}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <StatusBadge tone={severity === 'Critical' ? 'red' : severity === 'High' ? 'amber' : 'neutral'}>
      {severity}
    </StatusBadge>
  );
}
export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (string | { label: string; value: string })[];
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('select-wrap', className)}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      <ChevronDown size={13} />
    </div>
  );
}
export function Dropdown({
  trigger,
  children,
  align = 'start',
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-content" align={align} sideOffset={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function DropdownItem({
  children,
  onSelect,
  selected,
}: {
  children: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
}) {
  return (
    <DropdownMenu.Item className="dropdown-item" onSelect={onSelect}>
      {children}
      {selected && <Check size={14} className="ml-auto text-blue-600" />}
    </DropdownMenu.Item>
  );
}
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content" onCloseAutoFocus={onCloseAutoFocus}>
          <div className="dialog-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {description || 'Manage your Gateway workspace.'}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X size={18} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function EmptyState({
  title = 'No results found',
  description = 'Try adjusting your search or filters.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          className={cn(active === tab && 'active')}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
export function TextLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="text-link" href={href}>
      {children}
      <ArrowRight size={13} />
    </a>
  );
}
export function LoadingLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <Loader2 size={14} className="animate-spin" />
      {children}
    </>
  );
}
