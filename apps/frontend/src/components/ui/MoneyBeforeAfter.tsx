import { formatMoney } from '../../lib/currency';

/** Struck-through original amount -> highlighted new amount - the shared "here's what changed and why" treatment for anything a promo/adjustment discounts or boosts (insurance premium, acca boost, ...). */
export function MoneyBeforeAfter({ beforeCents, afterCents }: { beforeCents: number; afterCents: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-text-secondary line-through decoration-1">{formatMoney(beforeCents)}</span>
      <span className="text-text-secondary" aria-hidden="true">
        &rarr;
      </span>
      <span className="font-semibold text-highlight">{formatMoney(afterCents)}</span>
    </span>
  );
}
