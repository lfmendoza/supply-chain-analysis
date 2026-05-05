# Playbook de validación de la rúbrica

Este documento es la versión offline de la matriz `/rubric`. Para cada criterio
de la rúbrica oficial CC3089 (UVG, Sem I 2026) se documentan tres elementos:

1. **PRE** — consulta Cypher para fijar el estado inicial antes de la operación.
2. **Acción** — qué hacer en la UI (`/operations`, `/queries`, etc.) o el comando
   curl/API equivalente.
3. **POST** — la misma consulta de PRE: la diferencia entre las dos
   ejecuciones es la evidencia de que la operación tuvo el efecto declarado.

Las consultas se pueden pegar en Aura Console directamente: usan parámetros
`$nombre` que Aura acepta declarando `:param nombre => valor;` en la línea
anterior.

| Total | Puntos netos | Extras | Máximo |
|---|---|---|---|
| 100 | 100 | 20 | 120 |

---

## Modelado de datos (20 pts)

### Ítem 1 · Caso de uso adecuado (5 pts)

Cadena de suministro multinacional: proveedores, materias, productos, bodegas,
inventario, pedidos de cliente, pedidos de compra, envíos, rutas, transportistas,
clientes y ubicaciones (12 etiquetas, 18 tipos de relaciones).

**Evidencia**: panel `/`, `README.md`, `docs/data_model.md`.

### Ítem 2 · ≥5 etiquetas distintas con ≥5 propiedades cada una (5 pts)

```cypher
// PRE = POST (evidencia inicial; no requiere acción)
MATCH (n)
WITH labels(n)[0] AS label, n
RETURN label,
       count(n) AS instances,
       min(size(keys(n))) AS minProps,
       max(size(keys(n))) AS maxProps
ORDER BY label;
```

**Resultado esperado**: 12 etiquetas; `minProps` ≥ 5 en las etiquetas con
información de negocio (Supplier, Customer, Product, Warehouse, Inventory,
CustomerOrder, etc.).

### Ítem 3 · ≥10 tipos de relaciones con ≥3 propiedades (5 pts)

```cypher
MATCH ()-[r]->()
WITH type(r) AS type, r
WITH type,
     count(r) AS instances,
     max(size(keys(r))) AS maxProps,
     min(size(keys(r))) AS minProps
WITH collect({type: type, instances: instances, minProps: minProps, maxProps: maxProps}) AS rows
RETURN size(rows) AS totalTypes, rows;
```

**Resultado esperado**: `totalTypes` ≥ 10. SUPPLIES, USED_IN, CONNECTED_TO,
ALTERNATIVE_TO, FULFILLS, FOR_PRODUCT y USES_ROUTE tienen ≥ 3 propiedades.

### Ítem 4 · Todos los tipos nativos (5 pts)

```cypher
:param supplierId => 'S1';
:param locationId => 'LOC1';

MATCH (s:Supplier {id:$supplierId}), (l:Location {id:$locationId})
RETURN s.name           AS string_supplier,
       s.capacityPerWeek AS integer_capacity,
       s.riskScore       AS float_risk,
       s.isCertified     AS boolean_certified,
       s.certifications  AS list_certifications,
       s.registeredOn    AS date_registered,
       s.lastAuditAt     AS datetime_audit,
       l.coords          AS point_coords;
```

**Resultado esperado**: las 8 columnas tienen tipos String, Integer, Float,
Boolean, List, Date, DateTime y Point respectivamente.

---

## Set de datos (10 pts)

### Ítem 5 · Carga de datos por CSV (5 pts)

**Acción** (UI): `/operations` → pestaña "CSV" → seleccionar plantilla
"Suppliers" → subir `data/csv/suppliers.csv`. El backend usa MERGE/UNWIND.

**Verificación**:

```cypher
MATCH (s:Supplier) RETURN count(s) AS suppliers;
```

### Ítem 6 · Datos previamente cargados (2 pts)

**Acción** (terminal): `python -m scripts.seed_graph --reset`.

**Verificación** = ítem 7.

### Ítem 7 · ≥5000 nodos (2 pts)

```cypher
MATCH (n)
RETURN count(n) AS totalNodes,
       count(DISTINCT labels(n)[0]) AS distinctLabels,
       collect(DISTINCT labels(n)[0])[..15] AS sampleLabels;
```

**Resultado esperado**: `totalNodes` ≈ 5584 (Customer 600, CustomerOrder 2400,
Shipment 1500, PurchaseOrder 900, Inventory 75, Location 22, Route 49, etc.).

### Ítem 8 · Grafo conexo (1 pt)

```cypher
MATCH (n)
WHERE NOT (n)--()
RETURN count(n) AS isolated, collect(n.id)[..10] AS sample;
```

**Resultado esperado**: `isolated = 0`. El informe `/api/analysis/connectivity`
también valida una sola componente débilmente conexa.

---

## Aplicación funcional (70 pts)

> Todos los pasos siguen el patrón **PRE → acción → POST** sobre el mismo
> snapshot.

### Ítem 9 · Crear nodo con 1 etiqueta (5 pts)

```cypher
:param demoNodeId => 'DEMO-1';

// PRE: 0 filas
MATCH (n:DemoNode {id:$demoNodeId})
RETURN n.id AS id, labels(n) AS labels, properties(n) AS properties;
```

**Acción**:

```bash
curl -X POST http://localhost:8000/api/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{"labels":["DemoNode"],"properties":[
    {"key":"id","type":"string","value":"DEMO-1"},
    {"key":"name","type":"string","value":"demo"}]}'
```

**POST**: misma consulta. Resultado esperado: 1 fila con `labels=['DemoNode']`.

### Ítem 10 · Crear nodo con 2+ etiquetas (5 pts)

```cypher
:param demoSupplierId => 'S-DEMO-1';

MATCH (n:Supplier:Certified {id:$demoSupplierId})
RETURN n.id AS id, labels(n) AS labels, size(labels(n)) AS labelCount;
```

**Acción**:

```bash
curl -X POST http://localhost:8000/api/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{"labels":["Supplier","Certified"],"properties":[
    {"key":"id","type":"string","value":"S-DEMO-1"},
    {"key":"name","type":"string","value":"demo cert"}]}'
```

**POST esperado**: 1 fila con `labels=['Supplier','Certified']`, `labelCount=2`.

### Ítem 11 · Crear nodo con ≥5 propiedades (5 pts)

```cypher
:param demoTypedId => 'DT-1';

MATCH (n:DemoTyped {id:$demoTypedId})
RETURN n.id AS id, size(keys(n)) AS propertyCount, keys(n) AS propertyNames;
```

**Acción** (UI): `/operations` → Crear nodo → label `DemoTyped` con 5
propiedades tipadas (id string, name string, weight float, isActive boolean,
registeredOn date).

**POST esperado**: `propertyCount ≥ 5`.

### Ítem 12 · Visualización (1, muchos, agregadas) (5 pts)

```cypher
// 12.a · 1 nodo con sus propiedades
MATCH (s:Supplier {id:'S1'}) RETURN s;

// 12.b · muchos nodos con filtro
MATCH (s:Supplier)
RETURN s.id, s.name, s.country, s.status, s.riskScore
ORDER BY s.riskScore DESC LIMIT 20;

// 12.c · consulta agregada
MATCH (co:CustomerOrder)-[r:FOR_PRODUCT]->(p:Product)
WHERE co.status = 'pending'
RETURN p.id, p.name, count(co) AS orderCount, sum(r.quantity) AS pendingDemand
ORDER BY pendingDemand DESC LIMIT 10;
```

### Ítem 13 · Gestión de propiedades en nodos (10 pts)

Snapshot único reutilizable para los 6 sub-ítems:

```cypher
:param nodeId => 'S1';
MATCH (n {id:$nodeId})
RETURN n.id AS id, n.demoFlag AS demoFlag, n.demoTier AS demoTier, keys(n) AS keys;
```

#### 13.a · Agregar 1 propiedad a 1 nodo

```bash
curl -X PATCH http://localhost:8000/api/graph/nodes/S1 \
  -H "Content-Type: application/json" \
  -d '{"set":[{"key":"demoFlag","type":"boolean","value":true}]}'
```

POST: `demoFlag = true`.

#### 13.b · Agregar 1 propiedad a muchos nodos

Snapshot:

```cypher
MATCH (s:Supplier {country:'JP'})
RETURN s.id, s.demoTier
ORDER BY s.id;
```

Acción:

```bash
curl -X POST http://localhost:8000/api/graph/nodes/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "filter":{"label":"Supplier","where":[{"key":"country","type":"string","value":"JP"}]},
    "set":[{"key":"demoTier","type":"string","value":"premium"}]
  }'
```

POST: cada Supplier-JP tiene `demoTier='premium'`.

#### 13.c · Actualizar propiedad de 1 nodo

```bash
curl -X PATCH http://localhost:8000/api/graph/nodes/S2 \
  -H "Content-Type: application/json" \
  -d '{"set":[{"key":"riskScore","type":"float","value":0.10}]}'
```

#### 13.d · Actualizar propiedad de muchos nodos

```bash
curl -X POST http://localhost:8000/api/graph/nodes/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "filter":{"label":"CustomerOrder","where":[{"key":"priority","type":"integer","value":1}]},
    "set":[{"key":"status","type":"string","value":"urgent"}],
    "limit":1000
  }'
```

#### 13.e · Eliminar 1 propiedad de 1 nodo

```bash
curl -X PATCH http://localhost:8000/api/graph/nodes/S1 \
  -H "Content-Type: application/json" \
  -d '{"remove":["demoFlag"]}'
```

POST: `demoFlag = null`.

#### 13.f · Eliminar 1 propiedad de muchos nodos

```bash
curl -X POST http://localhost:8000/api/graph/nodes/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "filter":{"label":"Supplier","where":[{"key":"country","type":"string","value":"JP"}]},
    "remove":["demoTier"]
  }'
```

### Ítem 14 · Crear relación con ≥3 propiedades (5 pts)

```cypher
:param startId => 'S-DEMO-1';
:param endId   => 'S1';
:param relType => 'DEMO_LINK';

MATCH (a {id:$startId})-[r]->(b {id:$endId})
WHERE type(r) = $relType
RETURN type(r) AS type, size(keys(r)) AS propertyCount, properties(r) AS props;
```

Acción:

```bash
curl -X POST http://localhost:8000/api/graph/relationships \
  -H "Content-Type: application/json" \
  -d '{"startId":"S-DEMO-1","endId":"S1","type":"DEMO_LINK",
       "properties":[
         {"key":"weight","type":"float","value":1.5},
         {"key":"since","type":"date","value":"2026-01-01"},
         {"key":"notes","type":"string","value":"demo"}]}'
```

POST: `propertyCount = 3`.

### Ítem 15 · Gestión de relaciones (10 pts)

#### 15.a-b · Agregar/Actualizar propiedades en 1 / muchas relaciones

Snapshot:

```cypher
MATCH ()-[r:SUPPLIES]->()
RETURN count(r) AS total,
       sum(CASE WHEN r.riskFlag IS NOT NULL THEN 1 ELSE 0 END) AS withRiskFlag,
       avg(r.unitCost) AS avgCost;
```

Acción (bulk):

```bash
curl -X POST http://localhost:8000/api/graph/relationships/bulk-update \
  -H "Content-Type: application/json" \
  -d '{"filter":{"type":"SUPPLIES"},
       "set":[{"key":"riskFlag","type":"boolean","value":true}]}'
```

POST: `withRiskFlag = total`.

#### 15.c-d · Eliminar propiedades en 1 / muchas relaciones

```bash
curl -X POST http://localhost:8000/api/graph/relationships/bulk-update \
  -H "Content-Type: application/json" \
  -d '{"filter":{"type":"SUPPLIES"},"remove":["riskFlag"]}'
```

POST: `withRiskFlag = 0`.

### Ítem 16 · Eliminación de nodos (5 pts)

#### 16.a · 1 nodo

```bash
curl -X DELETE "http://localhost:8000/api/graph/nodes/DEMO-1?detach=true"
```

PRE/POST snapshot: `MATCH (n:DemoNode {id:'DEMO-1'}) RETURN n`.

#### 16.b · Muchos nodos (bulk)

```bash
curl -X POST http://localhost:8000/api/graph/nodes/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{"filter":{"label":"DemoBulk"},"confirm":true,"limit":1000}'
```

PRE/POST snapshot: `MATCH (n:DemoBulk) RETURN count(n) AS remaining`.

### Ítem 17 · Eliminación de relaciones (5 pts)

#### 17.a · 1 relación

```bash
curl -X DELETE "http://localhost:8000/api/graph/relationships/<elementId>"
```

#### 17.b · Muchas relaciones (bulk)

```bash
curl -X POST http://localhost:8000/api/graph/relationships/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{"filter":{"type":"DEMO_LINK"},"confirm":true}'
```

PRE/POST snapshot: `MATCH ()-[r:DEMO_LINK]->() RETURN count(r) AS remaining`.

### Ítem 18 · Consultas Cypher (15 pts)

El explorador expone 15 consultas analíticas (Q01-Q15) más 27 presets de
validación (V01-V27). El editor libre acepta cualquier Cypher con interruptor
lectura/escritura. Cada integrante demuestra al menos 2 consultas distintas:

| Integrante | Sugerencia |
|---|---|
| 1 | Q03 (tipos nativos), Q07 (single-source) |
| 2 | Q04 (trazabilidad por producto), Q11 (pedidos por horizonte) |
| 3 | Q08 (top riesgo), Q12 (demanda por producto) |
| 4 | Q14 (grado medio), V11 (consulta agregada) |

---

## Extras (20 pts)

### Ítem 19 · Algoritmo de Data Science (10 pts)

PageRank persistido en `Supplier.pagerank`:

**Acción**:

```bash
curl -X POST "http://localhost:8000/api/algorithms/persist-centrality?topN=20"
```

**Verificación**:

```cypher
MATCH (s:Supplier)
WHERE s.pagerank IS NOT NULL
RETURN s.id, s.name, s.pagerank
ORDER BY s.pagerank DESC LIMIT 10;
```

Otros algoritmos disponibles desde `/algorithms`: betweenness, comunidades
Louvain, camino más corto Dijkstra (ponderado por baseCost o leadTimeDays).

### Ítem 20 · Frontend excepcional (10 pts)

Nueve pantallas conectadas con narrativa única (Panel, Topología, Cypher,
Operaciones, Algoritmos, Simulación, Optimización, Comparación, Rúbrica). El
panel Cypher acepta deep-links del tipo `/queries?preset=val.X&p_*=...`, copia
queries con `:param` listas para Aura, y la matriz de rúbrica enlaza cada paso
con su preset PRE/POST.

---

## Verificación rápida (gate antes de la demo)

```bash
python -m scripts.seed_graph --reset
python -m scripts.test_phase1
python -m scripts.test_phase2
python -m scripts.test_phase4
python -m scripts.smoke_test
```

Las cuatro suites deben terminar con `*** PASSED.`. La matriz `/rubric` muestra
los puntos automáticos consultando `/api/analysis/connectivity`,
`/api/analysis/data-types` y `/api/graph/summary`.
