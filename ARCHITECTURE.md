# Architecture

This document visualizes how the platform's 23 features connect through a single dependency graph. For prose documentation, see [README.md](./README.md).

## System Overview

```mermaid
flowchart TB
    subgraph CLIENT["Browser / Mobile"]
        direction LR
        UI["React + TypeScript<br/>Vite + Tailwind"]
        WS_CLIENT["WebSocket<br/>alerts/stream"]
    end

    subgraph SERVER["FastAPI Server (single process)"]
        direction TB

        subgraph AGENT["APM Agent"]
            LLM["Groq LLM<br/>llama-3.3-70b<br/>tool_choice=required"]
        end

        subgraph ENGINES["Math Engines"]
            DEG["Non-linear SoH<br/>Quadratic accel"]
            ZSC["Z-score thermal<br/>anomaly detector"]
            GREEDY["Maintenance<br/>Greedy Scheduler"]
            EWMA["EWMA + CUSUM<br/>Drift Detection"]
            CPK["Process<br/>Capability Cpk"]
            CARBON["Scope 1/2/3<br/>Carbon Calculator"]
            COST["Battery Cost<br/>Commodity Model"]
        end

        subgraph INTEL["Intelligence"]
            SHAP["SHAP Explainer"]
            FORECAST["7-day Thermal<br/>365-day RUL"]
            SIM["What-If Carbon<br/>Simulator"]
            VENDOR["Vendor Scorecard"]
            COHORT["Cohort Analysis"]
            TCO["TCO Trend"]
            CC["Carbon Credit<br/>Marketplace"]
        end

        subgraph OPS["Operations"]
            DEPOT["Depot Registry<br/>5 depots"]
            RBAC["Role Permissions<br/>4 roles"]
            AUDIT["Audit Log +<br/>PDF Export"]
            APPROVAL["Approval Workflow<br/>> ₹5L threshold"]
        end

        subgraph SCHED["Background Scheduler"]
            JOBS["6 APScheduler jobs<br/>news 5m, anomaly 2m, ..."]
            WSH["WebSocket<br/>Broadcaster"]
        end

        subgraph STORE["Storage"]
            DB[("SQLite<br/>et_project.db")]
            CACHE["In-memory caches<br/>• news (5m)<br/>• OSM coords (∞)<br/>• alerts (100)"]
        end
    end

    subgraph EXT["External"]
        RSS["12 RSS Feeds<br/>(Mining.com, BBC, ...)"]
        OSM["OpenStreetMap<br/>Nominatim"]
        MCX["BSE/MCX<br/>commodity cache"]
    end

    UI <-->|REST| SERVER
    WS_CLIENT <-->|WebSocket| WSH
    LLM -->|tool calls| ENGINES
    ENGINES --> ANALYTICS_TAB[Analytics Tab]
    OPS --> UI
    WSH --> WS_CLIENT

    RSS --> JOBS
    OSM --> CACHE
    MCX --> COST
    ENGINES --> STORE
    ANALYTICS_TAB --> UI
    JOBS --> ENGINES
    JOBS --> ANALYTICS_TAB
    JOBS --> OPS

    LLM --> STORE
    STORE --> LLM

    classDef engine fill:#f5f5f4,stroke:#a8a29e,color:#1c1917
    classDef intel fill:#fafaf9,stroke:#d6d3d1,color:#1c1917
    classDef ops fill:#e7e5e4,stroke:#78716c,color:#1c1917
    classDef sched fill:#fef3c7,stroke:#d97706,color:#1c1917
    classDef store fill:#dbeafe,stroke:#2563eb,color:#1c1917
    classDef ui fill:#1c1917,stroke:#1c1917,color:#fafaf9

    class DEG,ZSC,GREEDY,EWMA,CPK,CARBON,COST engine
    class SHAP,FORECAST,SIM,VENDOR,COHORT,TCO,CC intel
    class DEPOT,RBAC,AUDIT,APPROVAL ops
    class JOBS,WSH,LLM sched
    class DB,CACHE store
    class UI,WS_CLIENT ui
```

## Data Flow: How Features Connect

```mermaid
flowchart LR
    RSS[("12 RSS Feeds")]:::source
    OSM[("OSM Nominatim")]:::source
    MCX[("BSE/MCX Cache")]:::source

    subgraph COMPUTE["Core Math"]
        TLM["Synthetic Telemetry Generator"]
        DEG["Non-linear SoH"]:::engine
        ZSC["Z-score Anomaly"]:::engine
        GREEDY["Maintenance Scheduler"]:::engine
        QMS["QMS / Drift Detection"]:::engine
        CARBON["Scope 1/2/3"]:::engine
        SC_RISK["Supply Chain Risk<br/>(news-derived)"]:::engine
    end

    subgraph FEATURES["Features the User Sees"]
        F1["F1: Fleet Readiness<br/>+ INR CapEx"]
        F3["F3: Maintenance<br/>Mobile + Web"]
        F4["F4: Supply Chain<br/>Map + Citations"]
        F5["F5: QMS Quality<br/>+ SHAP"]
        F6["F6: Net Zero<br/>Scope 1/2/3"]
        F2["F2: APM Agent<br/>Tool-Routed LLM"]
    end

    RSS --> SC_RISK
    OSM --> SC_RISK
    MCX --> F1
    TLM --> DEG --> ZSC --> F1
    ZSC --> GREEDY --> F3
    ZSC --> CARBON --> F6
    SC_RISK --> CARBON
    SC_RISK --> F4
    QMS --> F5
    CARBON --> F5

    F2 -.->|uses all engines| COMPUTE

    classDef source fill:#fef3c7,stroke:#d97706
    classDef engine fill:#f5f5f4,stroke:#a8a29e

    class RSS,OSM,MCX,TLM source
    class DEG,ZSC,GREEDY,QMS,CARBON,SC_RISK engine
```

**Reading this graph:** if RSS news changes, both F4 (supply chain risk) and F6 (Scope 3 carbon) update. If a battery degrades, F1 (readiness), F3 (maintenance), and F6 (Scope 1) all reflect it. **One data graph, one truth.**

## LLM Agent Tool Routing

```mermaid
flowchart TB
    Q["User Query<br/>e.g. 'show fleet health'"]
    LLM["Groq LLM<br/>tool_choice=required"]
    subgraph TOOLS["6 Available Tools"]
        T1["get_fleet_health"]
        T2["get_anomalies"]
        T3["get_maintenance_schedule"]
        T4["get_supply_chain_trace"]
        T5["get_quality_intelligence"]
        T6["get_carbon_report"]
    end
    KEY["Keyword Fallback<br/>(if LLM unreachable)"]

    Q --> LLM
    LLM -->|"picks 1"| TOOLS
    TOOLS -->|"executes<br/>deterministically"| MATH["Selected Math Engine"]
    MATH -->|"returns data"| RESULT["Results"]
    RESULT -->|"routed to UI"| TAB["Matching Tab"]

    Q --> KEY
    KEY --> TOOLS

    classDef fallback fill:#fee2e2,stroke:#dc2626
    class KEY fallback
```

Note: `tool_choice="required"` makes the LLM **always** pick a tool, even for vague queries like "hi" — no conversational hallucination, no empty responses.

## Live Alert Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant S as Scheduler<br/>(APScheduler)
    participant A as Alert Store<br/>(in-memory deque)
    participant W as WebSocket<br/>Broadcaster
    participant C as Client<br/>(LiveAlerts.tsx)

    Note over S: Every 2 min: anomaly_scan
    S->>S: Check thresholds<br/>(SoH < 80 = critical, etc.)
    S->>A: push_alert(severity, ...)
    A->>W: broadcast_alert_sync(alert)
    W-->>C: send_json({severity, message, ...})

    C->>C: dedup by alert_id
    C->>C: Show toast (8s auto-dismiss)
    C->>C: Increment unread counter
    C->>A: acknowledge_alert(id) on user click
    A-->>C: alert marked acknowledged
```

## Multi-Role Routing

```mermaid
flowchart TD
    L["Login<br/>admin/admin"]
    L --> J["JWT Token"]
    J --> AC["useAuth<br/>(AuthContext.tsx)"]
    AC --> R{"Role"}
    R -->|procurement| P["navItems:<br/>Fleet, Supply, Commodities,<br/>Quality, Carbon, Analytics"]
    R -->|maintenance| M["navItems:<br/>Fleet Health, Schedule,<br/>Work Orders, Mobile, Analytics"]
    R -->|executive| E["navItems:<br/>Dashboard, Carbon,<br/>Fleet, Supply, Analytics<br/>(read-only)"]
    R -->|admin| A["navItems:<br/>All 8 tabs"]
    P & M & E & A --> ROUTES["React Router<br/>(ErrorBoundary each)"]
```

## Memory Layout

```mermaid
flowchart TB
    subgraph PROCESS["FastAPI Process Memory"]
        subgraph CACHES["Stateless Caches"]
            C1["@lru_cache<br/>OSM coords<br/>(∞ lifetime)"]
            C2["_news_cache<br/>RSS articles<br/>(5 min TTL)"]
            C3["_commodity_cache<br/>Live prices<br/>(1 hour TTL)"]
            C4["_recent_alerts<br/>deque(maxlen=100)"]
            C5["_ws_clients<br/>set of WebSocket connections"]
        end

        subgraph SQLITE["et_project.db"]
            DB1["users table"]
            DB2["audit_log table"]
        end

        SCHED["APScheduler<br/>6 jobs<br/>(in-process threads)"]
    end
```

All caches are in-process — no Redis, no external broker. This is what makes the platform deployable as a single FastAPI process for hundreds of concurrent users.
