# Graph algorithms

Four algorithms exposed by the **Algorithms** page and `/algorithms/*`.

> **NetworkX vs GDS:** AuraDB Free does not include GDS. NetworkX runs in-process; graph size here is ~250 nodes / ~550 edges. Code: [`backend/app/analysis/algorithms.py`](../backend/app/analysis/algorithms.py).
The graph fed to the algorithms is the **core supply-chain subgraph**:
auxiliary labels like `DisruptionScenario` and `OptimizedAssignment` are
filtered out so the algorithms reason about the physical network only. See
[`backend/app/analysis/graph_loader.py`](../backend/app/analysis/graph_loader.py).

## 1. PageRank

- **Endpoint**: `GET /algorithms/pagerank?topN=20&weight=uniform|baseCost`
- **Implementation**: `networkx.pagerank` over the simplified directed graph.
  When `weight=baseCost` we transform each edge weight into
  `1 / (1 + baseCost)` so that *cheaper* edges propagate more importance,
  mirroring the intuition that low-friction lanes dominate flow.
- **What it tells us in a supply chain**: high PageRank flags the *hubs*
  (warehouses, key suppliers, central locations) whose disruption propagates
  the most. In our seeded dataset, top scores are reliably scarce raw
  materials (RM-A, RM-E) and Houston/Long Beach hubs.

## 2. Betweenness Centrality

- **Endpoint**: `GET /algorithms/betweenness?topN=20`
- **Implementation**: `networkx.betweenness_centrality` weighted by
  `baseCost`, normalised.
- **What it tells us**: nodes with high betweenness sit on the cheapest
  shortest paths between many pairs of other nodes — i.e. **bottlenecks**.
  Removing one of them either disconnects part of the graph or forces much
  longer alternatives. In the seeded data, RM-A, RM-E and warehouses W2/W5
  consistently show up.

## 3. Louvain Community Detection

- **Endpoint**: `GET /algorithms/communities`
- **Implementation**: `python-louvain` (`community.best_partition`) over the
  undirected projection, weighted by `baseCost`.
- **What it tells us**: the algorithm groups nodes that interact strongly
  with each other into **communities**. In a supply chain those communities
  surface naturally as *regional clusters* (a warehouse with its customers
  and the suppliers feeding it) or *product families* (the suppliers,
  materials and products that share a bill of materials).
- **Quality metric**: the result includes Newman modularity in `[-1, 1]`. We
  consistently get 0.50+ on the seeded graph, which is a strong signal of
  meaningful structure.

## 4. Dijkstra Shortest Path

- **Endpoint**: `GET /algorithms/shortest-path?source=&target=&weight=baseCost|leadTimeDays`
- **Implementation**: `networkx.dijkstra_path` over the **undirected** view,
  because the question "find me a route between supplier S1 and warehouse W1"
  is a logistical query. Edges in our model carry physical adjacency
  (a port-to-port lane is bidirectional) so an undirected view is the right
  abstraction.
- **What it tells us**: the cheapest route under the chosen weight. The UI
  highlights the path on the topology graph and reports total cost / hop
  count.

## Persisting centrality scores

`POST /algorithms/persist-centrality` runs PageRank and betweenness once and stores `pageRank` / `betweenness` on nodes so the property panel and topology can read them without recomputing.

The UI shows one card per algorithm (top N, short interpretation, highlight on the graph).
