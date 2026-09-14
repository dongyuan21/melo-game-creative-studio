# Agent-operable Boundary

Melo Game Creative Studio is **Agent-operable**, not Agent-embedded.

The product does not select an LLM, interpret natural-language prompts, or call a specific image/video/DCC provider. A human or external Agent may create textures, geometry, shaders, recipes, audio, or baked clips through any upstream tool. Melo begins enforcing rules when those outputs cross the artifact boundary.

## Responsibilities

### External creator or Agent

- Interpret creative intent.
- Choose upstream generators, DCC tools, or code-generation tools.
- Produce versioned asset manifests and files.
- Create material, effect, look, and variant recipes.
- React to machine-readable validation and quality reports.

### Melo Game Creative Studio

- Publish contracts and capabilities.
- Register and resolve versioned assets.
- Reject incompatible or unsafe artifacts.
- Compile a Creative Master plus Variant Recipe into one immutable Render Plan.
- Preserve frame-exact or semantic invariants.
- Apply deterministic rendering and batch execution.
- Produce quality reports and reproducibility metadata.

## Boundary rule

> Upstream authoring is open; downstream execution is strict.

Prompts may be retained as provenance, but a renderer never depends on a prompt at render time. Generated results must first be frozen into a versioned asset with a stable reference and, for production, a content hash.

## Clients

The Web UI, Melo CLI, future MCP adapter, CI jobs, and render workers must all call the same headless application services. No client is allowed to reimplement variant inheritance or quality policy independently.

The CLI is the atomic execution surface (`project scaffold`, `skin apply`, `agent run`, `take validate`, `document emit`, `render`, asset/variant/quality commands). Official and third-party **Skills** only sequence those commands. A new production taste (one take, many looks; resume render after Chrome appears) belongs in `skills/`, not as a fatter CLI verb.

Registered demo `gameId`s: `block-placement`, `taptile-tray-match3`, `block-crush-drop`. `mahjong-solitaire` is Studio Coming Soon only; `agent run` against it is `UNKNOWN_AGENT`.

## Code execution

Declarative JSON, media, texture sets, and GLB assets are preferred. Generated code is admitted only through a plugin package contract. Plugin execution is not enabled in v1; current validation rejects dangerous permissions by default. Later runtimes will use Workers, subprocess isolation, or WASM sandboxes rather than unrestricted `eval`.
