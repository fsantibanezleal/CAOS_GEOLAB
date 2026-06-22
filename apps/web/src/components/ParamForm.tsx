import type { ChangeEvent } from 'react';
import type { Layer, ParamSchema, ParamSpec } from '@geolab/tool-core';

interface Props {
  schema: ParamSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  layers: Layer[];
}

/** Auto-generated form from a tool's typed ParamSchema (the QGIS-Processing pattern — dossier 04 §3). */
export function ParamForm({ schema, values, onChange, layers }: Props) {
  return (
    <div className="pform">
      {Object.entries(schema).map(([key, spec]) => {
        if (spec.type === 'output') return null;
        const required = !('optional' in spec) || !spec.optional;
        const id = `p_${key}`;
        return (
          <div className="pfield" key={key}>
            <label htmlFor={id}>
              {spec.label}
              {required ? <span className="req"> *</span> : null}
            </label>
            {widget(id, key, spec, values[key], onChange, layers)}
            {'help' in spec && spec.help ? <span className="phelp">{spec.help}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function widget(
  id: string,
  key: string,
  spec: ParamSpec,
  v: unknown,
  onChange: (key: string, value: unknown) => void,
  layers: Layer[],
) {
  const str = v === undefined || v === null ? '' : String(v);
  switch (spec.type) {
    case 'number':
    case 'integer':
      return (
        <input
          id={id}
          type="number"
          value={str}
          step={spec.type === 'integer' ? 1 : 'any'}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'boolean':
      return <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.checked)} />;
    case 'enum':
      return (
        <select id={id} value={str} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(key, e.target.value || undefined)}>
          <option value="">—</option>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'layer': {
      const opts = layers.filter((l) => spec.accepts.includes(l.kind));
      return (
        <select id={id} value={str} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(key, e.target.value || undefined)}>
          <option value="">— select layer —</option>
          {opts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      );
    }
    case 'string':
    case 'crs':
      return <input id={id} type="text" value={str} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.value || undefined)} />;
    case 'file':
      return <span className="muted">file upload — coming</span>;
    case 'extent':
      return <span className="muted">draw on map — coming</span>;
    default:
      return null;
  }
}
