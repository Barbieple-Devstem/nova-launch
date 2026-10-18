import { Suspense, lazy, type ComponentProps } from 'react';
import { Card } from '../UI/Card';
import { Skeleton } from '../UI/Skeleton';

/**
 * Lazy-loaded chart components.
 *
 * recharts is large and only needed once a chart is on screen, so these
 * wrappers load the chart modules (and the shared `charts` vendor chunk) on
 * first render. Import from here, not from './SupplyChart' or the barrel,
 * anywhere the chart is not needed for the first paint.
 */

const SupplyChartImpl = lazy(() =>
  import('./SupplyChart').then((m) => ({ default: m.SupplyChart }))
);
const BurnRateChartImpl = lazy(() =>
  import('./BurnRateChart').then((m) => ({ default: m.BurnRateChart }))
);

/** Placeholder with the same footprint as a chart card, to avoid layout shift. */
export function ChartFallback({ label = 'Loading chart' }: { label?: string }) {
  return (
    <Card>
      <div role="status" aria-label={label} data-testid="chart-fallback">
        <Skeleton width={160} height={20} className="mb-4" />
        <Skeleton variant="rectangular" height={256} />
      </div>
    </Card>
  );
}

export function LazySupplyChart(props: ComponentProps<typeof SupplyChartImpl>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading supply chart" />}>
      <SupplyChartImpl {...props} />
    </Suspense>
  );
}

export function LazyBurnRateChart(props: ComponentProps<typeof BurnRateChartImpl>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading burn rate chart" />}>
      <BurnRateChartImpl {...props} />
    </Suspense>
  );
}
