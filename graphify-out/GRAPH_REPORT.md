# Graph Report - .  (2026-07-09)

## Corpus Check
- Corpus is ~32,616 words - fits in a single context window. You may not need a graph.

## Summary
- 576 nodes · 1066 edges · 32 communities (23 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.67)
- Token cost: 86,670 input · 0 output

## Community Hubs (Navigation)
- Save System & AI Bot
- Boot & Scene Setup
- Player View & Latency
- Shared Config & RNG
- Game Room & Networking
- Graphify Skill Docs
- Physics Simulation
- Client Prediction & Render Lerp
- Project README & Entry
- Graphify Export & Extraction Spec
- Audio Manager Sound Effects
- Snapshot Interpolation
- Server Package Config
- Client Package Config
- Client TS Config
- Server TS Config
- Input Controls
- Shared TS Config
- Shared Package Config
- Network Client Session
- Monorepo Root Config
- GitHub Clone & Merge
- Video Transcription
- Simulation README Refs
- Graphify Add Command
- HUD & PlayerView Docs
- GraphML Export
- SVG Export
- Token Benchmark
- Install Step
- Detect Step

## God Nodes (most connected - your core abstractions)
1. `AudioManager` - 27 edges
2. `OnlineGameScene` - 25 edges
3. `MapModel` - 24 edges
4. `GameScene` - 19 edges
5. `PredictionSystem` - 18 edges
6. `World` - 17 edges
7. `PlayerCore` - 17 edges
8. `NetworkClient` - 15 edges
9. `stepPlayer()` - 15 edges
10. `GameRoom` - 14 edges

## Surprising Connections (you probably didn't know these)
- `graphify Section (Project .claude/CLAUDE.md)` --semantically_similar_to--> `graphify Rules (Top-Level Project CLAUDE.md)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `graphify Rules (Top-Level Project CLAUDE.md)` --references--> `GRAPH_REPORT.md`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `src/main.ts (Client Bootstrap Script)` --conceptually_related_to--> `client/ (Phaser 3 + TypeScript)`  [INFERRED]
  client/index.html → README.md
- `ViewState` --references--> `HookPhase`  [EXTRACTED]
  client/src/entities/PlayerView.ts → shared/src/sim/types.ts
- `GameScene` --references--> `World`  [EXTRACTED]
  client/src/scenes/GameScene.ts → shared/src/sim/World.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Full Pipeline Steps (Detect -> Extract -> Build -> Label -> Export)** — skills_graphify_skill_step2_detect_files, skills_graphify_skill_step3_extract, skills_graphify_skill_step4_build_cluster_analyze, skills_graphify_skill_step4_5_health_check, skills_graphify_skill_step5_label_communities, skills_graphify_skill_step6_obsidian_html, skills_graphify_skill_step9_manifest_cost_cleanup [EXTRACTED 1.00]
- **graphify Navigation Commands (query/path/explain) Against Existing Graph** — skills_graphify_skill_query_command, skills_graphify_skill_path_command, skills_graphify_skill_explain_command, skills_graphify_skill_graph_json [EXTRACTED 1.00]
- **Hook Rush Shared Simulation Systems (Movement/Hook/Wall/World)** — readme_playersim_ts, readme_hooksim_ts, readme_wallsim_ts, readme_world_ts, readme_mapmodel_ts [EXTRACTED 1.00]

## Communities (32 total, 9 thin omitted)

### Community 0 - "Save System & AI Bot"
Cohesion: 0.05
Nodes (23): AIDiff, DEFAULTS, GameMode, SaveData, ActionPlan, AIBot, PARAMS, ParticleFX (+15 more)

### Community 1 - "Boot & Scene Setup"
Cohesion: 0.08
Nodes (13): SaveSystem, fittedWidth(), game, refit(), BootScene, GameOverScene, LobbyScene, DIFF_LABELS (+5 more)

### Community 2 - "Player View & Latency"
Cohesion: 0.07
Nodes (16): PlayerView, scratchView, ViewState, LatencyManager, NetworkClock, inputPacket(), pkt, MAX_REPLAY (+8 more)

### Community 3 - "Shared Config & RNG"
Cohesion: 0.07
Nodes (21): DifficultyManager, RNG, AbsAction, PatternInstance, ActionDef, ActionKind, AnchorDef, BlockDef (+13 more)

### Community 4 - "Game Room & Networking"
Cohesion: 0.09
Nodes (20): getServerUrl(), gameServer, port, GameRoom, PendingInput, NetPlayer, RoomState, syncPlayer() (+12 more)

### Community 5 - "Graphify Skill Docs"
Cohesion: 0.06
Nodes (32): graphify Section (Project .claude/CLAUDE.md), graphify Rules (Top-Level Project CLAUDE.md), graphify-out/wiki/index.md, Debounce (3s default), graphify.watch module, needs_update flag, --watch (background watcher), graphify claude install/uninstall (Native CLAUDE.md Integration) (+24 more)

### Community 6 - "Physics Simulation"
Cohesion: 0.17
Nodes (22): MapAnchor, SolidBlock, clamp(), constrainPendulum(), createHook(), hookDetach(), hookFire(), hookStep() (+14 more)

### Community 7 - "Client Prediction & Render Lerp"
Cohesion: 0.12
Nodes (7): InputRecord, PredictionSystem, Pose, PoseLerper, SimEvent, PlayerCore, World

### Community 8 - "Project README & Entry"
Cohesion: 0.11
Nodes (23): client/index.html (App Entry Point), Fullscreen Canvas Styling (No Black Bars), Safe-Area CSS Vars (Notch Handling), src/main.ts (Client Bootstrap Script), Authoritative Server Model (InputBits only, server decides physics), client/ (Phaser 3 + TypeScript), Client Prediction + Reconciliation, Deterministic Map Generation (Seed-Based) (+15 more)

### Community 9 - "Graphify Export & Extraction Spec"
Cohesion: 0.10
Nodes (22): graphify export falkordb / --falkordb-push, graphify.serve MCP Server, graphify export neo4j / --neo4j-push, graphify export wiki, EXTRACTED / INFERRED / AMBIGUOUS Confidence Levels, Hyperedges Rule, Node ID Format Rule, semantically_similar_to Edge Rule (+14 more)

### Community 11 - "Snapshot Interpolation"
Cohesion: 0.20
Nodes (7): Entry, InterpolationSystem, copySnap(), makeSnap(), RemoteSnap, SampleResult, SnapshotBuffer

### Community 12 - "Server Package Config"
Cohesion: 0.12
Nodes (16): dependencies, colyseus, @colyseus/schema, @hookrush/shared, devDependencies, colyseus.js, tsx, typescript (+8 more)

### Community 13 - "Client Package Config"
Cohesion: 0.12
Nodes (15): dependencies, colyseus.js, @hookrush/shared, phaser, devDependencies, typescript, vite, name (+7 more)

### Community 14 - "Client TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, paths (+6 more)

### Community 15 - "Server TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, paths (+6 more)

### Community 16 - "Input Controls"
Cohesion: 0.23
Nodes (5): PlayerInput, HoldButton, MobileControls, safeInset(), InputBits

### Community 17 - "Shared TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 18 - "Shared Package Config"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, exports, main, name, private, scripts, typecheck (+2 more)

### Community 20 - "Monorepo Root Config"
Cohesion: 0.20
Nodes (9): name, private, scripts, bot, build, dev, dev:server, version (+1 more)

### Community 21 - "GitHub Clone & Merge"
Cohesion: 0.50
Nodes (4): GitHub Clone Flow (graphify clone), Cross-Repo Merge (graphify merge-graphs), Monorepo Multi-Subfolder Flow (graphify extract per subfolder), Step 0 - GitHub repos and multi-path merge

### Community 22 - "Video Transcription"
Cohesion: 0.50
Nodes (3): Video/Audio Transcription Flow (Whisper), GRAPHIFY_WHISPER_PROMPT (Domain Hint), Step 2.5 - Video and Audio Detection

### Community 23 - "Simulation README Refs"
Cohesion: 0.50
Nodes (4): shared/sim/HookSim.ts (Hook), shared/sim/PlayerSim.ts (Movement/Physics/Collision), shared/sim/WallSim.ts (Wall), shared/sim/World.ts (Tick Order)

## Knowledge Gaps
- **137 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+132 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AudioManager` connect `Audio Manager Sound Effects` to `Save System & AI Bot`, `Boot & Scene Setup`, `Player View & Latency`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `MapModel` connect `Save System & AI Bot` to `Shared Config & RNG`, `Physics Simulation`, `Client Prediction & Render Lerp`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `World` connect `Client Prediction & Render Lerp` to `Save System & AI Bot`, `Shared Config & RNG`, `Game Room & Networking`, `Physics Simulation`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Save System & AI Bot` be split into smaller, more focused modules?**
  _Cohesion score 0.05267778753292362 - nodes in this community are weakly interconnected._
- **Should `Boot & Scene Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.07896575821104122 - nodes in this community are weakly interconnected._
- **Should `Player View & Latency` be split into smaller, more focused modules?**
  _Cohesion score 0.06588235294117648 - nodes in this community are weakly interconnected._