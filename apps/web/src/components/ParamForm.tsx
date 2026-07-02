import { type ChangeEvent, useEffect, useState } from 'react';
import type { Layer, ParamSchema, ParamSpec } from '@geolab/tool-core';

/** A user-selected local file, stored in param values for file-type params. */
export interface FileValue {
  name: string;
  bytes: Uint8Array;
}

interface Props {
  schema: ParamSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  layers: Layer[];
  errors?: Record<string, string>;
}

/** Auto-generated form from a tool's typed ParamSchema (the QGIS-Processing pattern — dossier 04 §3). */
export function ParamForm({ schema, values, onChange, layers, errors }: Props) {
  const inputEntries = Object.entries(schema).filter(([, spec]) => spec.type !== 'output');

  if (inputEntries.length === 0) {
    return (
      <div className="pform-empty">
        No input parameters required — click <strong>Run</strong> to proceed.
      </div>
    );
  }

  return (
    <div className="pform">
      {inputEntries.map(([key, spec]) => {
        const required = spec.type !== 'boolean' && !('optional' in spec && spec.optional);
        const id = `p_${key}`;
        const err = errors?.[key];
        return (
          <div className={`pfield${err ? ' pfield-err' : ''}`} key={key}>
            <label htmlFor={id}>
              {spec.label}
              {required ? <span className="req"> *</span> : null}
              {!required && spec.type !== 'boolean' ? <span className="opt"> (optional)</span> : null}
            </label>
            {renderWidget(id, key, spec, values[key], onChange, layers, values)}
            {err ? <span className="pfield-errmsg">{err}</span> : null}
            {'help' in spec && spec.help ? <span className="phelp">{spec.help}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── per-type widget renderers ────────────────────────────────────────────────

function renderWidget(
  id: string,
  key: string,
  spec: ParamSpec,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
  layers: Layer[],
  values: Record<string, unknown>,
): React.ReactNode {
  switch (spec.type) {
    case 'number':
    case 'integer': {
      const num = value === undefined || value === null ? '' : String(value);
      return (
        <input
          id={id}
          type="number"
          value={num}
          step={spec.type === 'integer' ? 1 : ('step' in spec && spec.step != null ? spec.step : 'any')}
          min={'min' in spec && spec.min != null ? spec.min : undefined}
          max={'max' in spec && spec.max != null ? spec.max : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(key, e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      );
    }

    case 'boolean':
      return (
        <label className="toggle-wrap">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.checked)}
          />
          <span className="toggle-label">{value ? 'Yes' : 'No'}</span>
        </label>
      );

    case 'enum': {
      const str = value === undefined || value === null ? '' : String(value);
      return (
        <select id={id} value={str} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(key, e.target.value || undefined)}>
          <option value="">— choose —</option>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    case 'layer':
      return <LayerWidget id={id} paramKey={key} spec={spec} value={value} layers={layers} onChange={onChange} />;

    case 'field':
      return <FieldWidget id={id} paramKey={key} spec={spec} value={value} values={values} layers={layers} onChange={onChange} />;

    case 'string':
    case 'crs': {
      const str = value === undefined || value === null ? '' : String(value);
      if (spec.type === 'string' && spec.multiline) {
        return (
          <textarea
            id={id}
            rows={3}
            value={str}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(key, e.target.value || undefined)}
          />
        );
      }
      return (
        <input
          id={id}
          type="text"
          value={str}
          placeholder={spec.type === 'crs' ? 'EPSG:4326' : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.value || undefined)}
        />
      );
    }

    case 'file':
      return <FileWidget id={id} paramKey={key} value={value} onChange={onChange} spec={spec} />;

    case 'extent':
      return <ExtentWidget id={id} paramKey={key} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

// ─── layer dropdown with availability hint ────────────────────────────────────

function LayerWidget({
  id, paramKey, spec, value, layers, onChange,
}: {
  id: string;
  paramKey: string;
  spec: Extract<ParamSpec, { type: 'layer' }>;
  value: unknown;
  layers: Layer[];
  onChange: (key: string, value: unknown) => void;
}) {
  const str = value === undefined || value === null ? '' : String(value);
  const matching = layers.filter((l) => spec.accepts.includes(l.kind));
  const kindLabel = spec.accepts.join('/');

  if (matching.length === 0) {
    return (
      <span className="pform-hint">
        No {kindLabel} layers — generate or upload one first.
      </span>
    );
  }

  return (
    <select
      id={id}
      value={str}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(paramKey, e.target.value || undefined)}
    >
      <option value="">— select {kindLabel} layer —</option>
      {matching.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </select>
  );
}

// ─── attribute-field dropdown (reads the columns of the layer chosen in another param) ─────────

function FieldWidget({
  id, paramKey, spec, value, values, layers, onChange,
}: {
  id: string;
  paramKey: string;
  spec: Extract<ParamSpec, { type: 'field' }>;
  value: unknown;
  values: Record<string, unknown>;
  layers: Layer[];
  onChange: (key: string, value: unknown) => void;
}) {
  const layerId = values[spec.fromLayerParam];
  const layer = typeof layerId === 'string' ? layers.find((l) => l.id === layerId) : undefined;
  const fields = layer?.fields ?? [];
  const str = value === undefined || value === null ? '' : String(value);

  // Preselect the tool's default field (e.g. directional_variogram → "value") when it exists on the layer.
  useEffect(() => {
    if (str || !fields.length) return;
    const wanted = spec.default && fields.some((f) => f.name === spec.default) ? spec.default : undefined;
    const firstNumeric = fields.find((f) => f.numeric)?.name;
    const pick = wanted ?? firstNumeric ?? fields[0]?.name;
    if (pick) onChange(paramKey, pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer?.id, fields.length]);

  if (!layer) {
    return <span className="pform-hint">Select the <strong>{spec.fromLayerParam}</strong> layer first — its columns appear here.</span>;
  }
  if (fields.length === 0) {
    return <span className="pform-hint">“{layer.name}” has no attribute fields to choose from.</span>;
  }
  return (
    <select id={id} value={str} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(paramKey, e.target.value || undefined)}>
      <option value="">— select field —</option>
      {fields.map((f) => (
        <option key={f.name} value={f.name}>{f.name}{f.numeric ? ' (number)' : ' (text)'}</option>
      ))}
    </select>
  );
}

// ─── 4-coordinate bbox widget ─────────────────────────────────────────────────

function ExtentWidget({
  id, paramKey, value, onChange,
}: {
  id: string;
  paramKey: string;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const arr = Array.isArray(value) ? (value as number[]) : [undefined, undefined, undefined, undefined];
  const labels = ['Min X (W)', 'Min Y (S)', 'Max X (E)', 'Max Y (N)'] as const;

  function update(idx: number, raw: string) {
    const next = [...arr] as (number | undefined)[];
    next[idx] = raw === '' ? undefined : Number(raw);
    const allFilled = next.every((n) => n !== undefined && !isNaN(n as number));
    onChange(paramKey, allFilled ? next as number[] : next.some((n) => n !== undefined) ? next : undefined);
  }

  return (
    <div className="extent-grid" id={id}>
      {labels.map((label, i) => (
        <label key={label} className="extent-cell">
          <span className="extent-label">{label}</span>
          <input
            type="number"
            step="any"
            value={arr[i] !== undefined && arr[i] !== null ? String(arr[i]) : ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => update(i, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

// ─── file picker ──────────────────────────────────────────────────────────────

function FileWidget({
  id, paramKey, value, onChange, spec,
}: {
  id: string;
  paramKey: string;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  spec: Extract<ParamSpec, { type: 'file' }>;
}) {
  const [status, setStatus] = useState<'idle' | 'reading' | 'done'>('idle');
  const fv = value as FileValue | undefined;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { onChange(paramKey, undefined); setStatus('idle'); return; }
    setStatus('reading');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      onChange(paramKey, { name: file.name, bytes } satisfies FileValue);
      setStatus('done');
    } catch {
      onChange(paramKey, undefined);
      setStatus('idle');
    }
  }

  const accept = 'accept' in spec && spec.accept ? spec.accept.join(',') : undefined;

  return (
    <div className="file-widget">
      <label className="btn btn-ghost file-btn">
        {status === 'reading' ? 'Reading…' : fv ? fv.name : 'Choose file'}
        <input id={id} type="file" hidden accept={accept} onChange={(e) => void handleChange(e)} />
      </label>
      {fv && <span className="pform-hint">{(fv.bytes.byteLength / 1024).toFixed(1)} KB loaded</span>}
    </div>
  );
}
