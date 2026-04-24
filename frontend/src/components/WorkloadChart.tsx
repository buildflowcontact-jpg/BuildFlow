import { BarChart3 } from 'lucide-react';
import { Suspense, lazy } from 'react';

const LazyWorkloadChartFull = lazy(() => import('./WorkloadChartFull'));

export default function WorkloadChart(props) {
  return (
    <Suspense fallback={<div>Chargement du graphique…</div>}>
      <LazyWorkloadChartFull {...props} />
    </Suspense>
  );
}
