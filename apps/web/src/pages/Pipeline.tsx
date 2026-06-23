/**
 * Pipeline editor — React Flow DAG of geolibre tools.
 * Nodes = tools; edges = data connections (untyped at v0.10, any-to-any).
 * Run = topologicalOrder() + sequential worker execution.
 * Save/Load = Recipe JSON download/upload.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import { Download, Play, StopCircle, Upload, X } from 'lucide-react';
import { InMemoryFS, topologicalOrder, type Layer, type Tool, type ToolRunContext } from '@geolab/tool-core';
import { loadGeolibreTools, getGeolibreManifest } from '../engines/geolibre';
import { loadTurfTools } from '../engines/turf';
import { collectRunArgs, guessOutputKind } from '@geolab/adapter-geolibre';
import type { WorkerRunResult } from '../lib/useWorkerRunner';

// ── Worker singleton (same as Workbench) ──────────────────────────────────────

let _pipelineWorker: Worker | null = null;
function getPipelineWorker(): Worker {
  if (!_pipelineWorker) {
    _pipelineWorker = new Worker(
      new URL('../workers/geolibre-worker.ts', import.meta.url),
      { type: 'module' },
    );
    _pipelineWorker.addEventListener('error', () => {
      _pipelineWorker?.terminate();
      _pipelineWorker = null;
    });
  }
  return _pipelineWorker;
}

function runWorkerTool(
  toolId: string,
  args: string[],
  input: Record<string, Uint8Array>,
): Promise<WorkerRunResult> {
  const worker = getPipelineWorker();
  const msgId = Date.now() + Math.random();
  return new Promise((resolve, reject) => {
    const safeInput: Record<string, Uint8Array> = {};
    const transferList: ArrayBuffer[] = [];
    for (const [fname, bytes] of Object.entries(input)) {
      const copy = new Uint8Array(bytes);
      safeInput[fname] = copy;
      transferList.push(copy.buffer as ArrayBuffer);
    }
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type: string; id: number; files?: Record<string, Uint8Array>; log?: string[]; message?: string };
      if (msg.id !== msgId) return;
      if (msg.type === 'RESULT') {
        worker.removeEventListener('message', handler);
        const files = msg.files ?? {};
        const outputs = Object.entries(files).map(([name, bytes]) => ({
          name,
          kind: guessOutputKind(name) as Layer['kind'],
          bytes: bytes as Uint8Array,
          format: /\.tif$/i.test(name) ? 'COG' : undefined,
        }));
        resolve({ outputs, log: msg.log ?? [] });
      } else if (msg.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error((msg.message as string | undefined) ?? 'Worker error'));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'RUN', id: msgId, toolId, args, input: safeInput }, transferList);
  });
}

// ── Tool node data type ────────────────────────────────────────────────────────

export interface ToolNodeData {
  toolId: string;
  toolName: string;
  category: string;
  params: Record<string, unknown>;
  status: 'idle' | 'running' | 'done' | 'error';
  [key: string]: unknown;
}

// ── Custom React Flow node ─────────────────────────────────────────────────────

function ToolNode({ data, selected }: NodeProps) {
  const d = data as ToolNodeData;
  const statusColor =
    d.status === 'done' ? 'var(--good)' :
    d.status === 'error' ? 'var(--bad)' :
    d.status === 'running' ? 'var(--warn)' : 'var(--border)';

  return (
    <div
      className="pn-node"
      style={{ outline: selected ? `2px solid var(--accent)` : `2px solid ${statusColor}` }}
    >
      <Handle type="target" position={Position.Left} className="pn-handle" />
      <div className="pn-body">
        <span className="pn-name">{d.toolName}</span>
        <span className="pn-cat chip">{d.category}</span>
        {d.status !== 'idle' && (
          <span className={`pn-status ${d.status}`}>
            {d.status === 'running' ? '⏳' : d.status === 'done' ? '✓' : '✗'}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="pn-handle" />
    </div>
  );
}

const nodeTypes = { tool: ToolNode };

// ── Log entry ─────────────────────────────────────────────────────────────────

interface PipelineLogEntry {
  nodeId: string;
  toolName: string;
  lines: string[];
  ok: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────────

let _nodeSeq = 0;

export function Pipeline() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [engineLoading, setEngineLoading] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeParams, setNodeParams] = useState<Record<string, Record<string, unknown>>>({});
  const [running, setRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<PipelineLogEntry[]>([]);
  const abortRef = useRef(false);
  const fsRef = useRef(new InMemoryFS());

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedTool = selectedNode
    ? tools.find((t) => t.id === (selectedNode.data as ToolNodeData).toolId) ?? null
    : null;

  // Load all engines on mount
  useEffect(() => {
    if (tools.length) return;
    setEngineLoading(true);
    loadGeolibreTools()
      .then((geolibreTools) => setTools([...loadTurfTools(), ...geolibreTools]))
      .finally(() => setEngineLoading(false));
  }, [tools.length]);

  const filteredTools = useMemo(() => {
    const q = toolSearch.toLowerCase();
    return q ? tools.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) : tools;
  }, [tools, toolSearch]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  function addToolNode(tool: Tool) {
    const id = `node-${++_nodeSeq}`;
    const newNode: Node<ToolNodeData> = {
      id,
      type: 'tool',
      position: { x: 120 + (_nodeSeq % 4) * 220, y: 80 + Math.floor(_nodeSeq / 4) * 140 },
      data: {
        toolId: tool.id,
        toolName: tool.name,
        category: tool.category,
        params: {},
        status: 'idle',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    setNodeParams((prev) => ({ ...prev, [id]: {} }));
  }

  function removeSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  function updateNodeStatus(id: string, status: ToolNodeData['status']) {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status } } : n,
      ),
    );
  }

  // Build pipeline DAG from React Flow nodes/edges
  function buildPipeline() {
    return {
      id: `pl-${Date.now()}`,
      name: 'GeoLab Pipeline',
      nodes: nodes.map((n) => ({
        id: n.id,
        toolId: (n.data as ToolNodeData).toolId,
        params: nodeParams[n.id] ?? {},
      })),
      edges: edges.map((e) => ({
        from: { node: e.source, port: 0 },
        to: { node: e.target, port: 0 },
      })),
    };
  }

  async function runPipeline() {
    if (running || nodes.length === 0) return;
    abortRef.current = false;
    setRunning(true);
    setPipelineLog([]);
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: 'idle' as const } })));

    const pipeline = buildPipeline();
    let order: string[];
    try {
      order = topologicalOrder(pipeline);
    } catch (e) {
      setPipelineLog([{ nodeId: '', toolName: '', lines: [String(e)], ok: false }]);
      setRunning(false);
      return;
    }

    // nodeId → output bytes (first output, for downstream chaining)
    const nodeOutputs = new Map<string, Uint8Array>();

    for (const nodeId of order) {
      if (abortRef.current) break;
      const pNode = pipeline.nodes.find((n) => n.id === nodeId);
      if (!pNode) continue;
      const tool = tools.find((t) => t.id === pNode.toolId);
      if (!tool) continue;
      updateNodeStatus(nodeId, 'running');

      // Wire upstream output as input bytes for this node (first upstream edge wins)
      const upEdge = edges.find((e) => e.target === nodeId);
      const layers: Layer[] = [];
      if (upEdge) {
        const upBytes = nodeOutputs.get(upEdge.source);
        if (upBytes) {
          const upKind = upBytes.length > 4 && upBytes[0] === 0x47 ? 'vector' : 'raster';
          const ext = upKind === 'vector' ? 'geojson' : 'tif';
          const ref = `pipe-${upEdge.source}.${ext}`;
          await fsRef.current.write(ref, upBytes);
          layers.push({ id: upEdge.source, name: 'upstream', kind: upKind, bytesRef: ref });
        }
      }

      const params = nodeParams[nodeId] ?? {};
      const manifest = getGeolibreManifest(tool.id);

      try {
        if (manifest) {
          // ── geolibre WASM worker path ──
          const getLayer = (id: string) => layers.find((l) => l.id === id);
          const { args, input } = await collectRunArgs(manifest, params, getLayer, (ref) => fsRef.current.read(ref).catch(() => new Uint8Array()));
          const result = await runWorkerTool(tool.id, args, input);
          const firstOut = result.outputs[0];
          if (firstOut) {
            nodeOutputs.set(nodeId, firstOut.bytes);
            const outRef = `pipe-out-${nodeId}.${firstOut.kind === 'raster' ? 'tif' : 'geojson'}`;
            await fsRef.current.write(outRef, firstOut.bytes);
          }
          updateNodeStatus(nodeId, 'done');
          setPipelineLog((prev) => [...prev, { nodeId, toolName: tool.name, lines: result.log, ok: true }]);
        } else {
          // ── main-thread path (Turf.js + future JS engines) ──
          const ctx: ToolRunContext = {
            fs: fsRef.current,
            layer: (id: string) => layers.find((l) => l.id === id),
            signal: new AbortController().signal,
            onProgress: () => undefined,
          };
          const result = await tool.run(ctx, params);
          const firstOut = result.outputs[0];
          if (firstOut?.bytesRef) {
            const bytes = await fsRef.current.read(firstOut.bytesRef);
            nodeOutputs.set(nodeId, bytes);
          }
          updateNodeStatus(nodeId, 'done');
          setPipelineLog((prev) => [...prev, { nodeId, toolName: tool.name, lines: result.log ?? [], ok: true }]);
        }
      } catch (e) {
        updateNodeStatus(nodeId, 'error');
        setPipelineLog((prev) => [...prev, { nodeId, toolName: tool.name, lines: [String(e)], ok: false }]);
      }
    }

    setRunning(false);
  }

  function cancelPipeline() {
    abortRef.current = true;
    setRunning(false);
  }

  // Save recipe JSON
  function saveRecipe() {
    const pipeline = buildPipeline();
    const toolVersions: Record<string, string> = {};
    for (const n of pipeline.nodes) {
      const t = tools.find((tl) => tl.id === n.toolId);
      if (t) toolVersions[n.toolId] = t.version;
    }
    const recipe = {
      schemaVersion: 1,
      pipeline,
      toolVersions,
      createdWith: 'GeoLab v0.10.000',
    };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geolab-recipe-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load recipe JSON
  function loadRecipe(file: File) {
    void file.text().then((text) => {
      try {
        const recipe = JSON.parse(text) as { pipeline: { nodes: Array<{ id: string; toolId: string; params: Record<string, unknown> }>; edges: Array<{ from: { node: string }; to: { node: string } }> } };
        const pl = recipe.pipeline;
        _nodeSeq = 0;
        const newNodes: Node<ToolNodeData>[] = pl.nodes.map((n, i) => {
          const tool = tools.find((t) => t.id === n.toolId);
          const id = n.id;
          _nodeSeq = Math.max(_nodeSeq, parseInt(id.replace('node-', ''), 10) || i);
          return {
            id,
            type: 'tool' as const,
            position: { x: 120 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 140 },
            data: {
              toolId: n.toolId,
              toolName: tool?.name ?? n.toolId,
              category: tool?.category ?? '',
              params: n.params,
              status: 'idle' as const,
            },
          };
        });
        const newEdges: Edge[] = pl.edges.map((e, i) => ({
          id: `e-${i}`,
          source: e.from.node,
          target: e.to.node,
          animated: true,
        }));
        const newParams: Record<string, Record<string, unknown>> = {};
        for (const n of pl.nodes) newParams[n.id] = n.params;
        setNodes(newNodes);
        setEdges(newEdges);
        setNodeParams(newParams);
        setSelectedNodeId(null);
        setPipelineLog([]);
      } catch (e) {
        console.error('Failed to load recipe:', e);
      }
    });
  }

  // Param editing for selected node
  function setParam(key: string, value: unknown) {
    if (!selectedNodeId) return;
    setNodeParams((prev) => ({
      ...prev,
      [selectedNodeId]: { ...(prev[selectedNodeId] ?? {}), [key]: value },
    }));
  }

  const currentParams = selectedNodeId ? (nodeParams[selectedNodeId] ?? {}) : {};

  return (
    <div className="pl-page">
      <section className="hero">
        <h1>{t('pl.title')}</h1>
        <p className="tagline">{t('pl.tagline')}</p>
      </section>

      <div className="pl-layout">
        {/* ── Left: tool picker ─────────────────────────────── */}
        <aside className="pl-sidebar panel">
          <h3>{t('toolbox.title')}</h3>
          {engineLoading ? (
            <p className="muted">{t('wb.engineLoading')}</p>
          ) : tools.length === 0 ? (
            <p className="muted">{t('pl.loadingTools')}</p>
          ) : (
            <>
              <input
                className="search"
                placeholder={t('toolbox.search')}
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
                style={{ width: '100%', marginTop: '.5rem', marginBottom: '.5rem' }}
              />
              <div className="pl-tool-list">
                {filteredTools.slice(0, 80).map((tool) => (
                  <div
                    key={tool.id}
                    className="pl-tool-item"
                    title={tool.summary}
                    onClick={() => addToolNode(tool)}
                  >
                    <span className="pl-tool-name">{tool.name}</span>
                    <span className="chip" style={{ fontSize: '.65rem' }}>{tool.category}</span>
                  </div>
                ))}
                {filteredTools.length > 80 && (
                  <p className="muted" style={{ fontSize: '.8rem', padding: '.3rem .5rem' }}>
                    {filteredTools.length - 80} more — refine search
                  </p>
                )}
              </div>
            </>
          )}
        </aside>

        {/* ── Center: React Flow canvas ─────────────────────── */}
        <div className="pl-canvas-wrap">
          <div className="pl-toolbar">
            <button
              type="button"
              className="btn"
              style={{ marginTop: 0 }}
              onClick={runPipeline}
              disabled={running || nodes.length === 0}
              title={t('pl.run')}
            >
              <Play size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {running ? t('pl.running') : t('pl.run')}
            </button>
            {running && (
              <button
                type="button"
                className="btn-cancel"
                onClick={cancelPipeline}
                title={t('wb.cancel')}
              >
                <StopCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                {t('wb.cancel')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 0 }}
              onClick={saveRecipe}
              disabled={nodes.length === 0}
              title={t('pl.save')}
            >
              <Download size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {t('pl.save')}
            </button>
            <label
              className="btn btn-ghost"
              style={{ marginTop: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={t('pl.load')}
            >
              <Upload size={14} />
              {t('pl.load')}
              <input
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadRecipe(f);
                  e.target.value = '';
                }}
              />
            </label>
            {selectedNode && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 0 }}
                onClick={removeSelectedNode}
                title={t('pl.removeNode')}
              >
                <X size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                {t('pl.removeNode')}
              </button>
            )}
            <span className="muted" style={{ fontSize: '.82rem', marginLeft: 'auto' }}>
              {nodes.length} {t('pl.nodes')} · {edges.length} {t('pl.edges')}
            </span>
          </div>

          <div className="pl-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              deleteKeyCode="Delete"
            >
              <Background />
              <Controls />
              <MiniMap zoomable pannable />
            </ReactFlow>
          </div>

          {nodes.length === 0 && (
            <div className="pl-empty">
              <p>{t('pl.emptyHint')}</p>
            </div>
          )}
        </div>

        {/* ── Right: node config + log ──────────────────────── */}
        <div className="pl-right panel">
          {selectedTool ? (
            <>
              <div className="step-h" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '.3rem' }}>
                <span>{selectedTool.name}</span>
                <span className="mono" style={{ fontSize: '.75rem' }}>{selectedTool.id}</span>
                <span className={`chip tier-${selectedTool.provenance.license.tier}`}>
                  {selectedTool.provenance.engine} · {selectedTool.provenance.license.spdx}
                </span>
              </div>
              <p className="tool-sum">{selectedTool.summary}</p>

              <div className="pform">
                {Object.entries(selectedTool.params)
                  .filter(([, spec]) => spec.type !== 'output')
                  .map(([key, spec]) => (
                    <div key={key} className="pfield">
                      <label>
                        {'label' in spec ? spec.label : key}
                        {'optional' in spec && spec.optional && <span className="opt"> (optional)</span>}
                      </label>
                      {(spec.type === 'number' || spec.type === 'integer') && (
                        <input
                          type="number"
                          value={String(currentParams[key] ?? ('default' in spec ? spec.default : '') ?? '')}
                          min={'min' in spec ? spec.min : undefined}
                          max={'max' in spec ? spec.max : undefined}
                          step={'step' in spec ? spec.step : undefined}
                          onChange={(e) => setParam(key, e.target.value === '' ? undefined : Number(e.target.value))}
                        />
                      )}
                      {spec.type === 'boolean' && (
                        <label className="toggle-wrap">
                          <input
                            type="checkbox"
                            checked={Boolean(currentParams[key] ?? spec.default)}
                            onChange={(e) => setParam(key, e.target.checked)}
                          />
                          <span className="toggle-label">{spec.label}</span>
                        </label>
                      )}
                      {spec.type === 'string' && (
                        <input
                          type="text"
                          value={String(currentParams[key] ?? ('default' in spec ? spec.default : '') ?? '')}
                          onChange={(e) => setParam(key, e.target.value)}
                        />
                      )}
                      {spec.type === 'enum' && (
                        <select
                          value={String(currentParams[key] ?? spec.default ?? '')}
                          onChange={(e) => setParam(key, e.target.value)}
                        >
                          {spec.options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      {spec.type === 'layer' && (
                        <input
                          type="text"
                          placeholder="layer id (auto-wired from upstream)"
                          value={String(currentParams[key] ?? '')}
                          onChange={(e) => setParam(key, e.target.value)}
                        />
                      )}
                      {'help' in spec && spec.help && (
                        <span className="phelp">{spec.help}</span>
                      )}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="muted">{t('pl.pickNode')}</p>
          )}

          {pipelineLog.length > 0 && (
            <details className="log" open style={{ marginTop: '1rem' }}>
              <summary>{t('pl.pipelineLog')}</summary>
              {pipelineLog.map((entry, i) => (
                <div key={i} className={`pl-log-entry ${entry.ok ? 'ok' : 'err'}`}>
                  <strong>{entry.toolName || 'Pipeline'}</strong>
                  {entry.lines.length > 0 && (
                    <pre style={{ margin: '.2rem 0 0', fontSize: '.78rem', color: 'var(--fg-subtle)', overflow: 'auto' }}>
                      {entry.lines.join('\n')}
                    </pre>
                  )}
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
