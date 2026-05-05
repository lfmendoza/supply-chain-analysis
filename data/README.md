# Data

The synthetic dataset lives here as plain JSON, regenerated from
`scripts/generate_dataset.py` with seed `42` so it is fully reproducible.

| File | Generator | Used by |
|---|---|---|
| `nodes.json` | static catalog + faker for customers / orders / shipments | `scripts/seed_graph.py` |
| `relationships.json` | derived from the same module | `scripts/seed_graph.py` |
| `disruption_seeds.json` | hand-crafted demo scenarios | suggestions for the Simulation page |

Regenerate with:

```bash
python -m scripts.generate_dataset
```

Or do it transparently together with seeding:

```bash
python -m scripts.seed_graph --reset
```
