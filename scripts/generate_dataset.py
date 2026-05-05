"""Generate a deterministic synthetic dataset for the supply-chain MVP.

Outputs three JSON files under `data/`:
  - nodes.json          : every node grouped by label
  - relationships.json  : every relationship grouped by type
  - disruption_seeds.json : suggested disruption scenarios for the demo

The dataset is intentionally crafted so that:
  * one RawMaterial (RM-A) is single-sourced (single-point-of-failure demo).
  * one route (R-MAIN) is critical (rerouting demo).
  * a handful of high-priority CustomerOrders depend on tight inventory.

Re-running the script produces identical files (seeded RNG).
"""

from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from faker import Faker

SEED = 42
random.seed(SEED)
Faker.seed(SEED)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

fake = Faker(["en_US", "es_MX"])


# ---------------------------------------------------------------------------
# Static catalog (hand-crafted ids and key relationships)
# ---------------------------------------------------------------------------

LOCATIONS: list[dict[str, Any]] = [
    {"id": "LOC1",  "name": "Tokyo Hub",        "country": "JP", "type": "hub",  "latitude": 35.68, "longitude": 139.69},
    {"id": "LOC2",  "name": "Yokohama Port",    "country": "JP", "type": "port", "latitude": 35.44, "longitude": 139.64},
    {"id": "LOC3",  "name": "Shanghai Port",    "country": "CN", "type": "port", "latitude": 31.23, "longitude": 121.47},
    {"id": "LOC4",  "name": "Long Beach Port",  "country": "US", "type": "port", "latitude": 33.77, "longitude": -118.19},
    {"id": "LOC5",  "name": "Los Angeles Hub",  "country": "US", "type": "hub",  "latitude": 34.05, "longitude": -118.24},
    {"id": "LOC6",  "name": "Dallas Hub",       "country": "US", "type": "hub",  "latitude": 32.78, "longitude": -96.80},
    {"id": "LOC7",  "name": "Mexico City Hub",  "country": "MX", "type": "hub",  "latitude": 19.43, "longitude": -99.13},
    {"id": "LOC8",  "name": "Veracruz Port",    "country": "MX", "type": "port", "latitude": 19.20, "longitude": -96.14},
    {"id": "LOC9",  "name": "Santiago Hub",     "country": "CL", "type": "hub",  "latitude": -33.45, "longitude": -70.66},
    {"id": "LOC10", "name": "Valparaiso Port",  "country": "CL", "type": "port", "latitude": -33.05, "longitude": -71.62},
    {"id": "LOC11", "name": "Sao Paulo Hub",    "country": "BR", "type": "hub",  "latitude": -23.55, "longitude": -46.63},
    {"id": "LOC12", "name": "Houston Hub",      "country": "US", "type": "hub",  "latitude": 29.76, "longitude": -95.37},
]

CARRIERS: list[dict[str, Any]] = [
    {"id": "CAR1", "name": "OceanLink Global",     "reliabilityScore": 0.92},
    {"id": "CAR2", "name": "AeroFreight Express",  "reliabilityScore": 0.85},
    {"id": "CAR3", "name": "Continental Trucking", "reliabilityScore": 0.78},
    {"id": "CAR4", "name": "Andes Logistics",      "reliabilityScore": 0.65},
]

SUPPLIERS: list[dict[str, Any]] = [
    {"id": "S1", "name": "Pacific Components Ltd", "country": "JP", "locationId": "LOC1",  "riskScore": 0.15, "capacityPerWeek": 5000},
    {"id": "S2", "name": "Yangtze Industrial",     "country": "CN", "locationId": "LOC3",  "riskScore": 0.32, "capacityPerWeek": 8000},
    {"id": "S3", "name": "Andes Metals SA",        "country": "CL", "locationId": "LOC9",  "riskScore": 0.62, "capacityPerWeek": 2000},
    {"id": "S4", "name": "Sierra Polymers",        "country": "MX", "locationId": "LOC7",  "riskScore": 0.28, "capacityPerWeek": 3500},
    {"id": "S5", "name": "Texas Hardware Co",      "country": "US", "locationId": "LOC6",  "riskScore": 0.18, "capacityPerWeek": 4500},
    {"id": "S6", "name": "Gulf Petrochem",         "country": "US", "locationId": "LOC12", "riskScore": 0.41, "capacityPerWeek": 6000},
    {"id": "S7", "name": "AmazonOre Brasil",       "country": "BR", "locationId": "LOC11", "riskScore": 0.55, "capacityPerWeek": 2800},
    {"id": "S8", "name": "Pacific Rim Plastics",   "country": "JP", "locationId": "LOC2",  "riskScore": 0.22, "capacityPerWeek": 4000},
]


# Certification catalog used to demonstrate the `List<String>` Neo4j datatype
# on Supplier nodes. Lower-risk suppliers get more certifications.
CERTIFICATION_POOL = ["ISO9001", "ISO14001", "ISO45001", "FAIR-TRADE", "ECOVADIS", "RoHS"]

# Materials: RM-A is intentionally single-sourced for the demo.
RAW_MATERIALS: list[dict[str, Any]] = [
    {"id": "RM-A", "name": "Specialty Alloy",   "unit": "kg", "criticality": "high"},
    {"id": "RM-B", "name": "Plastic Polymer",   "unit": "kg", "criticality": "med"},
    {"id": "RM-C", "name": "Copper Wire",       "unit": "m",  "criticality": "high"},
    {"id": "RM-D", "name": "Cardboard",         "unit": "kg", "criticality": "low"},
    {"id": "RM-E", "name": "Silicon Chip",      "unit": "u",  "criticality": "high"},
    {"id": "RM-F", "name": "Lithium Cell",      "unit": "u",  "criticality": "med"},
]

# Mapping (supplier -> [raw materials they can supply]).
SUPPLIES_MAP: list[dict[str, Any]] = [
    {"supplierId": "S1", "rawMaterialId": "RM-E", "unitCost": 12.50, "leadTimeDays": 14, "minOrderQty": 100},
    {"supplierId": "S1", "rawMaterialId": "RM-F", "unitCost": 8.75,  "leadTimeDays": 12, "minOrderQty": 200},
    {"supplierId": "S2", "rawMaterialId": "RM-B", "unitCost": 4.20,  "leadTimeDays": 18, "minOrderQty": 500},
    {"supplierId": "S2", "rawMaterialId": "RM-D", "unitCost": 1.10,  "leadTimeDays": 16, "minOrderQty": 1000},
    {"supplierId": "S3", "rawMaterialId": "RM-A", "unitCost": 22.40, "leadTimeDays": 21, "minOrderQty": 50},   # RM-A SOLO en S3
    {"supplierId": "S3", "rawMaterialId": "RM-C", "unitCost": 6.30,  "leadTimeDays": 19, "minOrderQty": 300},
    {"supplierId": "S4", "rawMaterialId": "RM-B", "unitCost": 4.80,  "leadTimeDays": 9,  "minOrderQty": 400},
    {"supplierId": "S4", "rawMaterialId": "RM-D", "unitCost": 1.25,  "leadTimeDays": 7,  "minOrderQty": 800},
    {"supplierId": "S5", "rawMaterialId": "RM-C", "unitCost": 6.80,  "leadTimeDays": 6,  "minOrderQty": 250},
    {"supplierId": "S5", "rawMaterialId": "RM-E", "unitCost": 13.10, "leadTimeDays": 8,  "minOrderQty": 100},
    {"supplierId": "S6", "rawMaterialId": "RM-B", "unitCost": 4.55,  "leadTimeDays": 10, "minOrderQty": 500},
    {"supplierId": "S7", "rawMaterialId": "RM-C", "unitCost": 5.95,  "leadTimeDays": 22, "minOrderQty": 300},
    {"supplierId": "S8", "rawMaterialId": "RM-F", "unitCost": 9.10,  "leadTimeDays": 13, "minOrderQty": 200},
]

# Alternative supplier hints (Plan B).
ALTERNATIVE_TO: list[dict[str, Any]] = [
    {"from": "S1", "to": "S5", "costDelta": 0.60,  "leadTimeDelta": -6},
    {"from": "S2", "to": "S4", "costDelta": 0.60,  "leadTimeDelta": -9},
    {"from": "S3", "to": "S7", "costDelta": -0.35, "leadTimeDelta": 1},
    {"from": "S5", "to": "S3", "costDelta": -0.50, "leadTimeDelta": 13},
]

PRODUCTS: list[dict[str, Any]] = [
    {"id": "P1",  "sku": "ELEC-001", "name": "Smart Sensor v2",     "category": "electronics", "unitCost": 45.00},
    {"id": "P2",  "sku": "ELEC-002", "name": "Power Module",        "category": "electronics", "unitCost": 62.00},
    {"id": "P3",  "sku": "ELEC-003", "name": "Wireless Router R5",  "category": "electronics", "unitCost": 89.00},
    {"id": "P4",  "sku": "ELEC-004", "name": "IoT Gateway",         "category": "electronics", "unitCost": 110.00},
    {"id": "P5",  "sku": "ELEC-005", "name": "Battery Pack 5kWh",   "category": "electronics", "unitCost": 230.00},
    {"id": "P6",  "sku": "MECH-001", "name": "Industrial Bearing",  "category": "mechanical",  "unitCost": 25.00},
    {"id": "P7",  "sku": "MECH-002", "name": "Precision Gearbox",   "category": "mechanical",  "unitCost": 180.00},
    {"id": "P8",  "sku": "MECH-003", "name": "Hydraulic Pump",      "category": "mechanical",  "unitCost": 320.00},
    {"id": "P9",  "sku": "PCKG-001", "name": "Reinforced Box L",    "category": "packaging",   "unitCost": 3.50},
    {"id": "P10", "sku": "PCKG-002", "name": "Protective Foam",     "category": "packaging",   "unitCost": 2.10},
    {"id": "P11", "sku": "ELEC-006", "name": "Solar Inverter 3kW",  "category": "electronics", "unitCost": 410.00},
    {"id": "P12", "sku": "ELEC-007", "name": "Smart Thermostat",    "category": "electronics", "unitCost": 75.00},
    {"id": "P13", "sku": "MECH-004", "name": "Compressor Unit",     "category": "mechanical",  "unitCost": 540.00},
    {"id": "P14", "sku": "ELEC-008", "name": "EV Charger 7kW",      "category": "electronics", "unitCost": 690.00},
    {"id": "P15", "sku": "PCKG-003", "name": "Pallet Wrap Roll",    "category": "packaging",   "unitCost": 0.80},
]

# Bill of materials: which raw materials each product uses.
USED_IN: list[dict[str, Any]] = [
    {"rawMaterialId": "RM-E", "productId": "P1",  "quantityPerUnit": 2},
    {"rawMaterialId": "RM-C", "productId": "P1",  "quantityPerUnit": 0.5},
    {"rawMaterialId": "RM-A", "productId": "P2",  "quantityPerUnit": 0.4},  # critical dep
    {"rawMaterialId": "RM-F", "productId": "P2",  "quantityPerUnit": 1},
    {"rawMaterialId": "RM-A", "productId": "P3",  "quantityPerUnit": 0.2},  # critical dep
    {"rawMaterialId": "RM-E", "productId": "P3",  "quantityPerUnit": 1},
    {"rawMaterialId": "RM-C", "productId": "P4",  "quantityPerUnit": 1.2},
    {"rawMaterialId": "RM-E", "productId": "P4",  "quantityPerUnit": 3},
    {"rawMaterialId": "RM-F", "productId": "P5",  "quantityPerUnit": 12},
    {"rawMaterialId": "RM-A", "productId": "P5",  "quantityPerUnit": 1.0},  # critical dep
    {"rawMaterialId": "RM-C", "productId": "P6",  "quantityPerUnit": 0.3},
    {"rawMaterialId": "RM-A", "productId": "P7",  "quantityPerUnit": 0.6},  # critical dep
    {"rawMaterialId": "RM-A", "productId": "P8",  "quantityPerUnit": 2.0},  # critical dep
    {"rawMaterialId": "RM-D", "productId": "P9",  "quantityPerUnit": 1.5},
    {"rawMaterialId": "RM-B", "productId": "P10", "quantityPerUnit": 0.8},
    {"rawMaterialId": "RM-A", "productId": "P11", "quantityPerUnit": 0.9},  # critical dep
    {"rawMaterialId": "RM-E", "productId": "P11", "quantityPerUnit": 4},
    {"rawMaterialId": "RM-E", "productId": "P12", "quantityPerUnit": 2},
    {"rawMaterialId": "RM-B", "productId": "P12", "quantityPerUnit": 0.3},
    {"rawMaterialId": "RM-A", "productId": "P13", "quantityPerUnit": 1.6},
    {"rawMaterialId": "RM-C", "productId": "P13", "quantityPerUnit": 2.5},
    {"rawMaterialId": "RM-E", "productId": "P14", "quantityPerUnit": 5},
    {"rawMaterialId": "RM-F", "productId": "P14", "quantityPerUnit": 8},
    {"rawMaterialId": "RM-D", "productId": "P15", "quantityPerUnit": 0.2},
]

WAREHOUSES: list[dict[str, Any]] = [
    {"id": "W1", "name": "LA Distribution Center",  "region": "US-West",   "locationId": "LOC5",  "storageCapacity": 25000, "dispatchCapacityPerWeek": 12000},
    {"id": "W2", "name": "Dallas Fulfillment",      "region": "US-South",  "locationId": "LOC6",  "storageCapacity": 18000, "dispatchCapacityPerWeek": 9000},
    {"id": "W3", "name": "Mexico City Warehouse",   "region": "MX",        "locationId": "LOC7",  "storageCapacity": 14000, "dispatchCapacityPerWeek": 7000},
    {"id": "W4", "name": "Sao Paulo Distribution",  "region": "BR",        "locationId": "LOC11", "storageCapacity": 16000, "dispatchCapacityPerWeek": 8000},
    {"id": "W5", "name": "Houston Cross-Dock",      "region": "US-South",  "locationId": "LOC12", "storageCapacity": 12000, "dispatchCapacityPerWeek": 6500},
]

# Routes (CONNECTED_TO links). Some duplicates intentionally to give alternatives.
ROUTES: list[dict[str, Any]] = [
    # Asia <-> Americas (sea)
    {"id": "R-MAIN", "from": "LOC2",  "to": "LOC4",  "mode": "sea",  "distanceKm": 9100, "baseCost": 1800, "leadTimeDays": 18, "carrierId": "CAR1"},
    {"id": "R02",    "from": "LOC3",  "to": "LOC4",  "mode": "sea",  "distanceKm": 10400,"baseCost": 1950, "leadTimeDays": 20, "carrierId": "CAR1"},
    {"id": "R03",    "from": "LOC2",  "to": "LOC8",  "mode": "sea",  "distanceKm": 12500,"baseCost": 2300, "leadTimeDays": 23, "carrierId": "CAR1"},
    # USA internal
    {"id": "R04",    "from": "LOC4",  "to": "LOC5",  "mode": "road", "distanceKm": 35,   "baseCost": 80,   "leadTimeDays": 1,  "carrierId": "CAR3"},
    {"id": "R05",    "from": "LOC5",  "to": "LOC6",  "mode": "road", "distanceKm": 2280, "baseCost": 950,  "leadTimeDays": 4,  "carrierId": "CAR3"},
    {"id": "R06",    "from": "LOC6",  "to": "LOC12", "mode": "road", "distanceKm": 380,  "baseCost": 220,  "leadTimeDays": 1,  "carrierId": "CAR3"},
    {"id": "R07",    "from": "LOC4",  "to": "LOC12", "mode": "road", "distanceKm": 2450, "baseCost": 1100, "leadTimeDays": 5,  "carrierId": "CAR3"},
    # Mexico
    {"id": "R08",    "from": "LOC8",  "to": "LOC7",  "mode": "road", "distanceKm": 400,  "baseCost": 240,  "leadTimeDays": 2,  "carrierId": "CAR3"},
    {"id": "R09",    "from": "LOC7",  "to": "LOC12", "mode": "road", "distanceKm": 1280, "baseCost": 620,  "leadTimeDays": 3,  "carrierId": "CAR3"},
    {"id": "R10",    "from": "LOC6",  "to": "LOC7",  "mode": "road", "distanceKm": 1380, "baseCost": 700,  "leadTimeDays": 3,  "carrierId": "CAR3"},
    # South America
    {"id": "R11",    "from": "LOC10", "to": "LOC11", "mode": "road", "distanceKm": 2800, "baseCost": 1300, "leadTimeDays": 6,  "carrierId": "CAR4"},
    {"id": "R12",    "from": "LOC9",  "to": "LOC10", "mode": "road", "distanceKm": 110,  "baseCost": 120,  "leadTimeDays": 1,  "carrierId": "CAR4"},
    {"id": "R13",    "from": "LOC10", "to": "LOC4",  "mode": "sea",  "distanceKm": 9700, "baseCost": 2050, "leadTimeDays": 22, "carrierId": "CAR1"},
    {"id": "R14",    "from": "LOC10", "to": "LOC8",  "mode": "sea",  "distanceKm": 5600, "baseCost": 1450, "leadTimeDays": 14, "carrierId": "CAR1"},
    # Air alternatives (faster but pricier)
    {"id": "R15",    "from": "LOC1",  "to": "LOC5",  "mode": "air",  "distanceKm": 8800, "baseCost": 4200, "leadTimeDays": 2,  "carrierId": "CAR2"},
    {"id": "R16",    "from": "LOC1",  "to": "LOC6",  "mode": "air",  "distanceKm": 10200,"baseCost": 4800, "leadTimeDays": 2,  "carrierId": "CAR2"},
    {"id": "R17",    "from": "LOC9",  "to": "LOC12", "mode": "air",  "distanceKm": 7900, "baseCost": 4500, "leadTimeDays": 2,  "carrierId": "CAR2"},
    # Hub interconnections
    {"id": "R18",    "from": "LOC1",  "to": "LOC2",  "mode": "road", "distanceKm": 30,   "baseCost": 60,   "leadTimeDays": 1,  "carrierId": "CAR3"},
    {"id": "R19",    "from": "LOC9",  "to": "LOC11", "mode": "air",  "distanceKm": 2700, "baseCost": 2200, "leadTimeDays": 1,  "carrierId": "CAR2"},
    {"id": "R20",    "from": "LOC11", "to": "LOC12", "mode": "sea",  "distanceKm": 8400, "baseCost": 1800, "leadTimeDays": 17, "carrierId": "CAR1"},
    {"id": "R21",    "from": "LOC11", "to": "LOC4",  "mode": "sea",  "distanceKm": 11200,"baseCost": 2100, "leadTimeDays": 21, "carrierId": "CAR1"},
    # Backup road to keep redundancy
    {"id": "R22",    "from": "LOC5",  "to": "LOC12", "mode": "road", "distanceKm": 2500, "baseCost": 1180, "leadTimeDays": 5,  "carrierId": "CAR3"},
    {"id": "R23",    "from": "LOC8",  "to": "LOC12", "mode": "sea",  "distanceKm": 1100, "baseCost": 380,  "leadTimeDays": 4,  "carrierId": "CAR1"},
    {"id": "R24",    "from": "LOC4",  "to": "LOC11", "mode": "sea",  "distanceKm": 11300,"baseCost": 2150, "leadTimeDays": 22, "carrierId": "CAR1"},
    {"id": "R25",    "from": "LOC2",  "to": "LOC10", "mode": "sea",  "distanceKm": 16500,"baseCost": 2700, "leadTimeDays": 27, "carrierId": "CAR1"},
    {"id": "R26",    "from": "LOC3",  "to": "LOC8",  "mode": "sea",  "distanceKm": 13800,"baseCost": 2480, "leadTimeDays": 25, "carrierId": "CAR1"},
    {"id": "R27",    "from": "LOC6",  "to": "LOC5",  "mode": "air",  "distanceKm": 2000, "baseCost": 1900, "leadTimeDays": 1,  "carrierId": "CAR2"},
    {"id": "R28",    "from": "LOC7",  "to": "LOC11", "mode": "air",  "distanceKm": 7400, "baseCost": 4100, "leadTimeDays": 2,  "carrierId": "CAR2"},
]


# ---------------------------------------------------------------------------
# Generators (random but seeded)
# ---------------------------------------------------------------------------

def _date_iso(d: date) -> str:
    return d.isoformat()


def _ts_iso(d: datetime) -> str:
    return d.replace(microsecond=0).isoformat() + "Z"


def generate_customers(n: int = 18) -> list[dict[str, Any]]:
    customers: list[dict[str, Any]] = []
    regions = ["US-West", "US-East", "US-South", "MX", "BR", "CL"]
    location_by_region = {
        "US-West": "LOC5",
        "US-East": "LOC4",
        "US-South": "LOC6",
        "MX": "LOC7",
        "BR": "LOC11",
        "CL": "LOC9",
    }
    tiers = ["gold", "silver", "bronze"]
    tier_weights = [0.2, 0.4, 0.4]
    for i in range(1, n + 1):
        region = random.choice(regions)
        customers.append({
            "id": f"CUST{i}",
            "name": fake["en_US"].company(),
            "region": region,
            "tier": random.choices(tiers, weights=tier_weights, k=1)[0],
            "locationId": location_by_region[region],
        })
    return customers


def generate_inventory() -> list[dict[str, Any]]:
    """Inventory entries (Warehouse, Product) — covers ~half the catalog per warehouse."""
    inventory: list[dict[str, Any]] = []
    inv_idx = 1
    for w in WAREHOUSES:
        # Pick 6-8 distinct products per warehouse.
        products_subset = random.sample(PRODUCTS, k=random.randint(6, 8))
        for p in products_subset:
            safety = random.randint(50, 200)
            qty = max(0, int(safety * random.uniform(0.4, 2.4)))
            inventory.append({
                "id": f"INV{inv_idx}",
                "warehouseId": w["id"],
                "productId": p["id"],
                "quantity": qty,
                "safetyStock": safety,
                "reorderPoint": int(safety * 1.3),
            })
            inv_idx += 1
    return inventory


def generate_customer_orders(customers: list[dict[str, Any]], n: int = 50) -> list[dict[str, Any]]:
    today = date(2026, 5, 1)
    orders: list[dict[str, Any]] = []
    priorities = [1, 2, 3]
    priority_weights = [0.25, 0.45, 0.30]
    for i in range(1, n + 1):
        cust = random.choice(customers)
        prod = random.choice(PRODUCTS)
        qty = random.randint(5, 80)
        priority = random.choices(priorities, weights=priority_weights, k=1)[0]
        revenue = round(qty * prod["unitCost"] * random.uniform(1.20, 1.65), 2)
        due_offset = random.randint(3, 28)
        orders.append({
            "id": f"CO{i}",
            "customerId": cust["id"],
            "productId": prod["id"],
            "quantity": qty,
            "dueDate": _date_iso(today + timedelta(days=due_offset)),
            "priority": priority,
            "status": "pending",
            "revenue": revenue,
        })
    return orders


def generate_purchase_orders(n: int = 30) -> list[dict[str, Any]]:
    today = date(2026, 5, 1)
    statuses = ["pending", "fulfilled", "in_transit"]
    pos: list[dict[str, Any]] = []
    for i in range(1, n + 1):
        rel = random.choice(SUPPLIES_MAP)
        qty = max(rel["minOrderQty"], random.randint(rel["minOrderQty"], rel["minOrderQty"] * 4))
        placed = today - timedelta(days=random.randint(1, 25))
        expected = placed + timedelta(days=rel["leadTimeDays"])
        pos.append({
            "id": f"PO{i}",
            "supplierId": rel["supplierId"],
            "rawMaterialId": rel["rawMaterialId"],
            "quantity": qty,
            "placedAt": _date_iso(placed),
            "expectedAt": _date_iso(expected),
            "status": random.choice(statuses),
        })
    return pos


def generate_shipments(orders: list[dict[str, Any]], n: int = 40) -> list[dict[str, Any]]:
    today = datetime(2026, 5, 1, 9, 0, 0)
    shipments: list[dict[str, Any]] = []
    chosen_orders = random.sample(orders, k=min(n, len(orders)))
    statuses = ["delivered", "in_transit", "delayed"]
    for i, co in enumerate(chosen_orders, start=1):
        warehouse = random.choice(WAREHOUSES)
        route = random.choice(ROUTES)
        delay = random.choices([0, 0, 0, 1, 2, 4, 7], k=1)[0]
        status = "delayed" if delay >= 4 else random.choice(statuses)
        shipments.append({
            "id": f"SH{i}",
            "orderId": co["id"],
            "customerId": co["customerId"],
            "warehouseId": warehouse["id"],
            "routeId": route["id"],
            "dispatchedAt": _ts_iso(today - timedelta(days=random.randint(0, 12))),
            "status": status,
            "delayDays": delay,
            "actualLeadTime": route["leadTimeDays"] + delay,
            "fulfillmentPct": 100 if status == "delivered" else random.choice([50, 75, 100]),
        })
    return shipments


def build_disruption_seeds() -> list[dict[str, Any]]:
    return [
        {
            "id": "DS-DEMO-1",
            "type": "supplier_down",
            "description": "Andes Metals SA (S3) goes offline; RM-A is the single-source dependency.",
            "params": {"supplierId": "S3"},
        },
        {
            "id": "DS-DEMO-2",
            "type": "route_blocked",
            "description": "R-MAIN (Yokohama -> Long Beach) blocked by port closure.",
            "params": {"routeId": "R-MAIN"},
        },
        {
            "id": "DS-DEMO-3",
            "type": "demand_spike",
            "description": "Demand for P5 (Battery Pack 5kWh) spikes by 60%.",
            "params": {"productId": "P5", "factor": 1.60},
        },
        {
            "id": "DS-DEMO-4",
            "type": "inventory_drop",
            "description": "Inventory for high-priority products drops 50%.",
            "params": {"factor": 0.50, "criteria": "priority<=2"},
        },
        {
            "id": "DS-DEMO-5",
            "type": "cost_increase",
            "description": "Sea routes cost increases 35% (fuel surge).",
            "params": {"factor": 1.35, "mode": "sea"},
        },
    ]


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def _enrich_supplier(s: dict[str, Any]) -> dict[str, Any]:
    """Add typed properties to a supplier so the rubric criterion "all data
    types" is covered:
      - certifications  : List<String>
      - isCertified     : Boolean
      - registeredOn    : Date         (ISO string, converted in seed)
      - lastAuditAt     : DateTime     (ISO string, converted in seed)
    """
    risk = s["riskScore"]
    # Lower risk -> more certifications. We sample deterministically.
    cert_count = max(1, int(round((1.0 - risk) * 4)))
    cert_count = min(cert_count, len(CERTIFICATION_POOL))
    certifications = sorted(random.sample(CERTIFICATION_POOL, k=cert_count))
    is_certified = len(certifications) >= 2

    registered_year = random.randint(2008, 2022)
    registered = date(registered_year, random.randint(1, 12), random.randint(1, 28))

    audit = datetime(2026, 1, 1) - timedelta(
        days=random.randint(15, 700),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )
    return {
        **s,
        "status": "active",
        "certifications": certifications,
        "isCertified": is_certified,
        "registeredOn": _date_iso(registered),
        "lastAuditAt": _ts_iso(audit),
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    customers = generate_customers()
    inventory = generate_inventory()
    customer_orders = generate_customer_orders(customers)
    purchase_orders = generate_purchase_orders()
    shipments = generate_shipments(customer_orders)

    suppliers = [_enrich_supplier(s) for s in SUPPLIERS]
    routes_with_status = [
        {**r, "status": "open"} for r in ROUTES
    ]

    nodes = {
        "Location": LOCATIONS,
        "Carrier": CARRIERS,
        "Supplier": suppliers,
        "RawMaterial": RAW_MATERIALS,
        "Product": PRODUCTS,
        "Warehouse": WAREHOUSES,
        "Inventory": [{k: v for k, v in i.items() if k not in ("warehouseId", "productId")} for i in inventory],
        "Customer": customers,
        "CustomerOrder": [{k: v for k, v in co.items() if k != "customerId" and k != "productId"} for co in customer_orders],
        "PurchaseOrder": [{k: v for k, v in po.items() if k not in ("supplierId", "rawMaterialId")} for po in purchase_orders],
        "Shipment": [{k: v for k, v in s.items() if k not in ("orderId", "customerId", "warehouseId", "routeId")} for s in shipments],
        "Route": [{"id": r["id"], "mode": r["mode"], "distanceKm": r["distanceKm"], "status": r["status"]} for r in routes_with_status],
    }

    relationships = {
        "LOCATED_AT_SUPPLIER": [{"from": s["id"], "to": s["locationId"]} for s in SUPPLIERS],
        "LOCATED_AT_WAREHOUSE": [{"from": w["id"], "to": w["locationId"]} for w in WAREHOUSES],
        "LOCATED_AT_CUSTOMER": [{"from": c["id"], "to": c["locationId"]} for c in customers],
        "SUPPLIES": SUPPLIES_MAP,
        "USED_IN": USED_IN,
        "CONNECTED_TO": [
            {
                "from": r["from"],
                "to": r["to"],
                "routeId": r["id"],
                "distanceKm": r["distanceKm"],
                "baseCost": r["baseCost"],
                "leadTimeDays": r["leadTimeDays"],
                "status": "open",
            }
            for r in ROUTES
        ],
        "CARRIED_BY": [
            {"routeId": r["id"], "carrierId": r["carrierId"], "costMultiplier": 1.0}
            for r in ROUTES
        ],
        "ALTERNATIVE_TO": ALTERNATIVE_TO,
        "HAS_INVENTORY": [{"warehouseId": i["warehouseId"], "inventoryId": i["id"]} for i in inventory],
        "OF_PRODUCT": [{"inventoryId": i["id"], "productId": i["productId"]} for i in inventory],
        "PLACED_BY": [{"orderId": co["id"], "customerId": co["customerId"]} for co in customer_orders],
        "FOR_PRODUCT": [
            {"orderId": co["id"], "productId": co["productId"], "quantity": co["quantity"]}
            for co in customer_orders
        ],
        "SOURCED_FROM": [{"orderId": po["id"], "supplierId": po["supplierId"]} for po in purchase_orders],
        "FOR_MATERIAL": [{"orderId": po["id"], "rawMaterialId": po["rawMaterialId"]} for po in purchase_orders],
        "FULFILLS": [{"shipmentId": s["id"], "orderId": s["orderId"], "fulfillmentPct": s["fulfillmentPct"]} for s in shipments],
        "SHIPS_FROM": [{"shipmentId": s["id"], "warehouseId": s["warehouseId"]} for s in shipments],
        "DELIVERS_TO": [{"shipmentId": s["id"], "customerId": s["customerId"]} for s in shipments],
        "USES_ROUTE": [{"shipmentId": s["id"], "routeId": s["routeId"], "actualLeadTime": s["actualLeadTime"]} for s in shipments],
    }

    disruption_seeds = build_disruption_seeds()

    (DATA_DIR / "nodes.json").write_text(json.dumps(nodes, indent=2, ensure_ascii=False))
    (DATA_DIR / "relationships.json").write_text(json.dumps(relationships, indent=2, ensure_ascii=False))
    (DATA_DIR / "disruption_seeds.json").write_text(json.dumps(disruption_seeds, indent=2, ensure_ascii=False))

    counts = {label: len(items) for label, items in nodes.items()}
    rel_counts = {rel: len(items) for rel, items in relationships.items()}
    print("Dataset generated under", DATA_DIR)
    print("Node counts: ", counts)
    print("Relationship counts: ", rel_counts)


if __name__ == "__main__":
    main()
