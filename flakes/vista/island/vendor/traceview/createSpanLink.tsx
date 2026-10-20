// STUB: original imports Grafana app-glue (datasource_srv, tempo/prometheus plugins).
// Only `pyroscopeProfileIdTagKey` is needed on the TraceTimelineViewer render path.
import { type TraceSpan } from './components/types/trace';
export type SpanLinkFunc = (span: TraceSpan) => unknown;
export const pyroscopeProfileIdTagKey = 'pyroscope.profile.id';
export const defaultProfilingKeys: string[] = [];
export function createSpanLinkFactory(): undefined {
  return undefined;
}
