# Graph Report - netmon_go  (2026-10-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 454 nodes · 850 edges · 71 communities (12 shown, 59 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fe7ee543`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- Hub
- iface.go
- Store
- models.ts
- frontend/package.json
- compilerOptions
- runtime/package.json
- wails.json
- runtime.js
- runtime.d.ts
- main.go
- compilerOptions
- EventsOnMultiple
- BrowserOpenURL
- CanResolveFilePaths
- CheckNotificationAuthorization
- CleanupNotifications
- ClipboardGetText
- ClipboardSetText
- EventsOff
- EventsOffAll
- Hide
- InitializeNotifications
- LogDebug
- LogError
- LogFatal
- LogInfo
- LogPrint
- LogTrace
- LogWarning
- OnFileDrop
- OnFileDropOff
- RegisterNotificationCategory
- RemoveAllDeliveredNotifications
- RemoveAllPendingNotifications
- RemoveNotification
- RemoveNotificationCategory
- RemovePendingNotification
- RequestNotificationAuthorization
- ResolveFilePaths
- ScreenGetAll
- SendNotification
- SendNotificationWithActions
- Show
- WindowCenter
- WindowFullscreen
- WindowGetPosition
- WindowGetSize
- WindowHide
- WindowIsMaximised
- WindowIsMinimised
- WindowIsNormal
- WindowMaximise
- WindowReload
- WindowReloadApp
- WindowSetAlwaysOnTop
- WindowSetBackgroundColour
- WindowSetDarkTheme
- WindowSetLightTheme
- WindowSetMaxSize
- WindowSetPosition
- WindowSetSize
- WindowSetSystemDefaultTheme
- WindowSetTitle
- WindowShow
- WindowUnfullscreen
- WindowUnmaximise
- WindowUnminimise
- netscope

## God Nodes (most connected - your core abstractions)
1. `Hub` - 43 edges
2. `Store` - 24 edges
3. `App` - 20 edges
4. `App()` - 17 edges
5. `compilerOptions` - 16 edges
6. `HistoryPage()` - 13 edges
7. `Overview()` - 12 edges
8. `New()` - 11 edges
9. `react` - 10 edges
10. `Device` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App` --references--> `Hub`  [EXTRACTED]
  app.go → internal/hub/hub.go
- `App` --references--> `Store`  [EXTRACTED]
  app.go → internal/store/store.go
- `New()` --calls--> `DefaultInterface()`  [EXTRACTED]
  internal/hub/hub.go → internal/collect/iface.go
- `openTemp()` --calls--> `Open()`  [INFERRED]
  internal/store/store_test.go → internal/store/store.go
- `Hub` --references--> `IfaceSampler`  [EXTRACTED]
  internal/hub/hub.go → internal/collect/iface.go

## Import Cycles
- None detected.

## Communities (71 total, 59 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.05
Nodes (79): alertTone(), App(), Props, SeriesDef, Spark(), SparkProps, TimeChart(), Kpi() (+71 more)

### Community 1 - "Hub"
Cohesion: 0.08
Nodes (22): latencyBucket, latencyFlush, trafficBucket, Gateway(), Info(), Names(), ARP(), Sweep() (+14 more)

### Community 2 - "iface.go"
Cohesion: 0.06
Nodes (18): cacheEntry, Sample, Connections(), procName(), proto(), DefaultInterface(), IfaceSampler, hexToIP() (+10 more)

### Community 3 - "Store"
Cohesion: 0.06
Nodes (11): Event, History, LatencyRow, Settings, TrafficRow, boolInt(), DefaultPath(), Store (+3 more)

### Community 4 - "models.ts"
Cohesion: 0.06
Nodes (12): Conn, Device, Event, History, IfaceInfo, LatencyPoint, LatencyRow, model (+4 more)

### Community 5 - "frontend/package.json"
Cohesion: 0.07
Nodes (28): dependencies, lucide-react, react, react-dom, uplot, devDependencies, tailwindcss, @tailwindcss/vite (+20 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 7 - "runtime/package.json"
Cohesion: 0.12
Nodes (15): author, bugs, url, description, homepage, keywords, license, main (+7 more)

### Community 8 - "wails.json"
Cohesion: 0.18
Nodes (10): author, email, name, frontend:build, frontend:dev:serverUrl, frontend:dev:watcher, frontend:install, name (+2 more)

### Community 9 - "runtime.js"
Cohesion: 0.20
Nodes (8): Environment(), IsNotificationAvailable(), Quit(), RemoveDeliveredNotification(), WindowIsFullscreen(), WindowMinimise(), WindowSetMinSize(), WindowToggleMaximise()

### Community 10 - "runtime.d.ts"
Cohesion: 0.25
Nodes (7): EnvironmentInfo, NotificationAction, NotificationCategory, NotificationOptions, Position, Screen, Size

### Community 12 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

## Knowledge Gaps
- **5 isolated node(s):** `tailwindcss`, `@types/react`, `@types/react-dom`, `typescript`, `netscope`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Hub` connect `Hub` to `iface.go`, `Store`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `tailwindcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054199328107502796 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `frontend/package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Store` connect `Store` to `Hub`, `iface.go`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `iface.go` be split into smaller, more focused modules?**
  _Cohesion score 0.06431372549019608 - nodes in this community are weakly interconnected._