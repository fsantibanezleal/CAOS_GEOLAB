"""Dump authoritative WhiteboxTools per-tool parameters -> a committed JSON the browser imports.

Run ONCE (offline) per geolibre-wasm engine bump, inside data-pipeline/.venv-pipeline:
    pip install whitebox
    python dump_params.py ../../packages/adapters/geolibre/whitebox-params.json

geolibre-wasm@0.4.4 embeds a WhiteboxTools build whose 138 tools ship empty params in listManifests();
this fills them from the same metadata every WBT front-end uses (--toolparameters JSON). License: MIT.
See wip/geolab/remediation/01-whitebox-params-and-docs.md.
"""
import json
import os
import sys

import whitebox

OUT = sys.argv[1] if len(sys.argv) > 1 else "whitebox-params.json"

wbt = whitebox.WhiteboxTools()
wbt.set_verbose_mode(False)

try:
    version = wbt.version().splitlines()[0].strip()
except Exception:
    version = "unknown"

tools = wbt.list_tools()  # {snake_name: description}
out = {
    "_meta": {
        "engine": "WhiteboxTools",
        "wbt_version": version,
        "license": "MIT (c) 2017-2021 John Lindsay",
        "note": "Authoritative per-tool parameters; baked to fill geolibre-wasm's empty manifests.",
    },
    "tools": {},
}

n_params = 0
n_empty = 0
for snake, desc in tools.items():
    camel = "".join(w.capitalize() for w in snake.split("_"))
    try:
        params = json.loads(wbt.tool_parameters(camel)).get("parameters", [])
    except Exception:
        params = []
    try:
        toolbox = wbt.toolbox(camel).strip()
    except Exception:
        toolbox = ""
    if not params:
        n_empty += 1
    out["tools"][snake] = {"tool": camel, "description": desc, "toolbox": toolbox, "parameters": params}
    n_params += len(params)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"wbt_version={version} tools={len(out['tools'])} params={n_params} empty={n_empty} -> {OUT}")
