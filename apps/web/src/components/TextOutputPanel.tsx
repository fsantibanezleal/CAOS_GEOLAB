import type { PortKind } from '@geolab/tool-core';

interface Props {
  content: string;
  title?: string;
  kind: PortKind;
}

const HINTS: Partial<Record<PortKind, string>> = {
  pointcloud: 'Binary LiDAR file (LAZ/LAS). Statistics from the tool log are shown below.',
  table: 'Tabular output from the tool.',
};

/** Renders text, table, and lidar-stats outputs from tool runs. */
export function TextOutputPanel({ content, title, kind }: Props) {
  return (
    <div className="text-out-panel">
      {title && <div className="rtitle">{title}</div>}
      {HINTS[kind] && <p className="text-out-hint muted">{HINTS[kind]}</p>}
      <pre className="text-out-pre">{content || '(no output)'}</pre>
    </div>
  );
}
