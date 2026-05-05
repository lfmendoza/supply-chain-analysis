# Análisis y Optimización de Cadena de Suministro sobre Neo4j

Proyecto del curso **Bases de Datos 2 (CC3089, UVG, Semestre I 2026)**. Modela una cadena de suministro multinacional como un grafo en **Neo4j AuraDB** y construye sobre él una plataforma de análisis, simulación de disrupciones y reoptimización operativa.

---

## 1. El problema

Las cadenas de suministro reales son redes densas con dependencias de muchos saltos: un proveedor en Asia provee una materia prima crítica que entra en un producto que se almacena en varios centros de distribución y termina cumpliendo pedidos para clientes en distintos países. Cuando ocurre una disrupción —un puerto cerrado, un proveedor caído, una caída de inventario— el equipo de operaciones necesita responder tres preguntas en minutos:

1. **¿Qué se rompe?** Trazabilidad: qué proveedores, materias, productos, pedidos y clientes están expuestos.
2. **¿Qué tan grave es?** Cuantificación: ingresos en riesgo, pedidos sin cumplir, costos adicionales, retrasos.
3. **¿Qué hacemos?** Replanteo: qué pedido se asigna a qué bodega, qué proveedor alternativo usar, qué ruta tomar.

Las consultas multi-salto, los caminos alternativos y los componentes conexos se expresan de forma natural en Cypher pero son costosas y tortuosas en SQL. La asignación de pedidos a bodegas con capacidad limitada es un problema combinatorio que ningún motor de grafos resuelve por sí solo. La plataforma combina ambos mundos.

---

## 2. La solución

```text
                          ┌──> NetworkX  (PageRank · Betweenness · Louvain · Dijkstra)
                          │
Grafo (Neo4j) ──> Features ──> ML (riskScore) ──> Optimizador (OR-Tools) ──> Grafo (Neo4j)
                          │                                                ▲
                          └──> Motor de simulación ─────────────────────────┘
```

| Capa | Responsabilidad | Tecnología |
|---|---|---|
| **Modelado** | 14 etiquetas, 20 tipos de relaciones, 8 tipos nativos de Neo4j | Neo4j AuraDB 5.x |
| **CRUD operativo** | Crear / actualizar / eliminar nodos y relaciones (uno o muchos) | FastAPI + Pydantic |
| **Consultas analíticas** | 15+ presets Cypher en 5 categorías y editor libre con modo lectura/escritura | Driver oficial Neo4j |
| **Algoritmos de grafos** | Centralidad (PageRank, betweenness), comunidades (Louvain) y caminos óptimos (Dijkstra) | NetworkX |
| **Riesgo de proveedores** | Modelo entrenado sobre features del grafo que reescribe `riskScore` en `Supplier` | scikit-learn (RandomForest) |
| **Simulación de disrupciones** | Snapshots reversibles que materializan el impacto sobre proveedores, rutas e inventario | Motor propio en Python |
| **Optimización combinatoria** | Reasignación pedido→bodega con capacidad, inventario y multi-objetivo | OR-Tools (CP-SAT) |
| **Visualización** | Topología interactiva, panel de propiedades, KPIs, comparativas | React + Vite + Tailwind + Cytoscape.js + Plotly |

### Por qué grafo, y no solo SQL

- **Trazabilidad multi-hop natural**: `(Supplier)-[:SUPPLIES]->(RawMaterial)-[:USED_IN]->(Product)<-[:FOR_PRODUCT]-(CustomerOrder)-[:PLACED_BY]->(Customer)` es una sola línea de Cypher; en SQL son cinco joins recursivos.
- **Caminos alternativos y rutas más cortas**: `shortestPath` y patrones `*1..N` resuelven en milisegundos lo que requeriría CTEs recursivas con condiciones de parada.
- **Detección de fuente única**: `MATCH (rm)<-[:SUPPLIES]-(s) WITH rm, count(s) AS n WHERE n=1` identifica los puntos únicos de fallo de un vistazo.
- **Tipado nativo**: `Date`, `DateTime`, `Point` (WGS-84), `List<String>`, `Boolean` viajan sin transformaciones a través del driver.

### Por qué NetworkX y no GDS

Neo4j AuraDB Free **no incluye el plugin GDS**. NetworkX cubre PageRank, betweenness, Louvain y Dijkstra a la escala del proyecto (<10k nodos) ejecutando en proceso. Los scores se devuelven a la UI o se persisten en el grafo según el caso.

### Por qué OR-Tools

La asignación de pedidos a bodegas con capacidad limitada, restricciones de inventario por producto y objetivo multi-criterio (costo, tiempo, riesgo, ingresos) es un problema combinatorio que Cypher no expresa. CP-SAT resuelve instancias realistas en segundos y devuelve un asignamiento óptimo (o el mejor encontrado) que se materializa de vuelta como nodos `OptimizedAssignment` y relaciones `RECOMMENDED`.

---

## 3. Estructura del repositorio

```text
backend/      Servicio FastAPI: cliente Neo4j, CRUD, simulación, optimización, ML, KPIs
cypher/       Constraints e índices + las 10 consultas analíticas originales
data/         Dataset JSON generado por scripts/generate_dataset.py
data/csv/     CSVs de demostración para la pestaña de carga masiva
docs/         Arquitectura, modelo de datos, formulación del optimizador, ML, algoritmos, rúbrica, guion de demo
frontend/     Dashboard React (Panel, Topología, Cypher, Operaciones, Algoritmos, Simulación, Optimización, Comparación, Rúbrica)
scripts/      Generador, seed, comprobador de conexión, entrenamiento ML, smoke tests, exportador de CSV
```

---

## 4. Requisitos previos

- **Python 3.11+**
- **Node.js 18+**
- Una instancia gratuita de [Neo4j AuraDB](https://console.neo4j.io)

---

## 5. Configuración inicial

### 5.1. Credenciales de AuraDB

1. Inicia sesión en <https://console.neo4j.io>.
2. Crea una instancia gratuita (Neo4j 5.x).
3. Guarda la contraseña autogenerada (solo se muestra una vez) y la URI de conexión (`neo4j+s://xxxxxxxx.databases.neo4j.io`).
4. Espera a que el estado de la instancia sea **Running**.

### 5.2. Variables de entorno

```bash
cp .env.example backend/.env
# Edita backend/.env con tu URI / usuario / contraseña / base de datos
```

Variable opcional para deployments compartidos:

```ini
ALLOW_CYPHER_WRITE=true   # por defecto; ponlo en false para deshabilitar el modo escritura del explorador Cypher
```

`backend/.env` está en `.gitignore`. **Nunca subas credenciales reales al repositorio.**

---

## 6. Puesta en marcha

### 6.1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Verifica la conexión:

```bash
cd ..
python -m scripts.check_connection
```

Salida esperada:

```text
OK -> Neo4j AuraDB connection successful
```

> **Nota sobre TLS en Windows**: el certificado TLS de AuraDB está firmado por SSL.com, cuya raíz no siempre está en el almacén de certificados de Windows. El driver de Neo4j puede fallar con `ServiceUnavailable: Unable to retrieve routing information`. La clase `Neo4jClient` resuelve esto inyectando un `SSLContext` construido a partir del bundle de [`certifi`](https://pypi.org/project/certifi/), por lo que el escenario funciona automáticamente. Para diagnóstico ejecuta `python -m scripts.tls_probe` o `python -m scripts.diagnose_connection`.

Carga el dataset sintético (idempotente, cubre los 8 tipos nativos):

```bash
python -m scripts.seed_graph --reset
```

Exporta los CSVs de demostración (consumidos por la pestaña de carga masiva):

```bash
python -m scripts.export_csv
```

Entrena el modelo de riesgo (opcional pero recomendado antes de la demo):

```bash
python -m scripts.train_risk_model
```

Levanta la API:

```bash
cd backend
uvicorn app.main:app --reload
```

Documentación interactiva: <http://localhost:8000/docs>

### 6.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

La UI queda disponible en <http://localhost:5173>. El servidor de Vite proxy-ea `/api` a `http://localhost:8000`.

---

## 7. Recorrido sugerido

Para una demostración guiada paso a paso, ver [`docs/demo_script.md`](docs/demo_script.md) y la matriz de validación en [`docs/rubric.md`](docs/rubric.md).

| # | Pantalla | Qué se demuestra |
|---|---|---|
| 1 | **Panel** (`/`) | KPIs globales, conectividad, cobertura de tipos nativos |
| 2 | **Topología** (`/topology`) | Grafo interactivo con filtros, búsqueda y panel de propiedades |
| 3 | **Cypher** (`/queries`) | 15 consultas predefinidas en 5 categorías + editor libre con modo lectura/escritura |
| 4 | **Operaciones** (`/operations`) | CRUD de nodos y relaciones, reconexión de aristas, importación CSV |
| 5 | **Algoritmos** (`/algorithms`) | PageRank, betweenness, comunidades Louvain, camino más corto |
| 6 | **Simulación** (`/simulation`) | Disrupciones reversibles (proveedor caído, ruta bloqueada, demanda spike, etc.) |
| 7 | **Optimización** (`/optimization`) | Reasignación CP-SAT con función objetivo multi-criterio |
| 8 | **Comparación** (`/comparison`) | Métricas base vs. disruptivo vs. optimizado |
| 9 | **Rúbrica** (`/rubric`) | Matriz de validación con enlaces a la evidencia dentro de la app |

---

## 8. Pruebas de humo

El repositorio incluye cuatro suites end-to-end que ejercitan todas las capas:

```bash
python -m scripts.smoke_test     # ML + simulación + optimización + comparación
python -m scripts.test_phase1    # CRUD + ejecutor Cypher + conectividad + tipos de datos
python -m scripts.test_phase2    # PageRank, betweenness, comunidades, camino más corto
python -m scripts.test_phase4    # Carga CSV (nodos y relaciones)
```

Las cuatro deben terminar con `*** PASSED.`.

---

## 9. Seguridad

- `.env`, `backend/.env` y `frontend/.env*` están en `.gitignore`.
- Las credenciales nunca se loggean: el helper `Settings.safe_repr()` omite la contraseña.
- El explorador Cypher inicia en **modo solo lectura**; cambiar a escritura requiere confirmación explícita en la UI y respeta la variable `ALLOW_CYPHER_WRITE`.
- Si una credencial llega a quedar expuesta (captura de pantalla, log, chat), rota la contraseña desde la consola de AuraDB inmediatamente.

---

## 10. Licencia

MIT — ver el encabezado de `backend/pyproject.toml`.
