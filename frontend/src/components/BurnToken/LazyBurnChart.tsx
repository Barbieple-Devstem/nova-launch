import { Suspense, lazy, type ComponentProps } from 'react';
import { ChartFallback } from '../TokenAnalytics/LazyCharts';

/** BurnChart loaded on demand so recharts stays out of the initial bundle. */
const BurnChartImpl = lazy(() => import('./BurnChart'));

export function LazyBurnChart(props: ComponentProps<typeof BurnChartImpl>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading burn chart" />}>
      <BurnChartImpl {...props} />
    </Suspense>
  );
}
