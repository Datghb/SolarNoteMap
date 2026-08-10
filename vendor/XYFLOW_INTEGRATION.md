# xyflow integration reference

The upstream repository is cloned at `vendor/xyflow` from:

- Repository: `https://github.com/xyflow/xyflow.git`
- Upstream commit at integration time: `ee40209`
- Runtime package: `@xyflow/react` 12.11.2

SolarNoteMap adapts patterns from the official React examples:

- `examples/react/src/examples/Layouting`
- `examples/react/src/examples/SaveRestore`
- `examples/react/src/examples/InteractiveMinimap`

The application integration lives in `src/components/KnowledgeFlow.tsx`. The
vendored clone is a reference checkout; production imports continue to use the
published `@xyflow/react` package so dependency updates remain reproducible.
