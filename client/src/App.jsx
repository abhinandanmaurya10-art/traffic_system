import { useEffect, useMemo, useState } from "react";
import { getSignalPlayback, runSimulation } from "./simulation.js";

const ROADS = ["North", "South", "East", "West"];
const DEFAULT_COUNTS = { North: 10, South: 6, East: 18, West: 8 };
const DEFAULT_WEIGHTS = { vehicle_count: 1, waiting_time: 0.5, pedestrian: 2 };
const HISTORY_STORAGE_KEY = "flowstate-simulation-history";

function TrafficLight({ color = "red", timer, animated = false }) {
  return (
    <div className="signal-unit" aria-label={`${color} signal`}>
      <div className="signal-housing">
        {["red", "yellow", "green"].map((bulb) => (
          <span
            className={`signal-bulb ${bulb} ${color === bulb ? "lit" : ""} ${color === bulb && animated ? "animated" : ""}`}
            key={bulb}
          />
        ))}
      </div>
      <span className="signal-timer">{timer ?? "--"}</span>
    </div>
  );
}

function Junction({ cycle, phase, secondsRemaining, isPlaying }) {
  const activeRoad = cycle?.selectedRoad;
  const road = (name) => (
    <div className={`junction-road ${activeRoad === name ? "is-active" : ""}`} key={name}>
      <TrafficLight
        color={activeRoad === name && phase !== "complete" && phase !== "all-red" ? phase : "red"}
        timer={activeRoad === name && phase !== "complete" ? secondsRemaining : undefined}
        animated={isPlaying && activeRoad === name && (phase === "green" || phase === "yellow")}
      />
      <span className="road-name">{name}</span>
      <span className="road-count">{cycle?.counts?.[name] ?? "—"} vehicles</span>
      {cycle?.pedestrianRoads?.includes(name) && <span className="road-badge">Walk request</span>}
      {cycle?.emergencyRoad === name && <span className="road-badge emergency-badge">Emergency</span>}
    </div>
  );

  return (
    <div className="junction-map">
      <div className="road-strip road-vertical" />
      <div className="road-strip road-horizontal" />
      <div className="junction-center"><span>FLOW<br />CONTROL</span></div>
      <div className="road-slot north">{road("North")}</div>
      <div className="road-slot south">{road("South")}</div>
      <div className="road-slot west">{road("West")}</div>
      <div className="road-slot east">{road("East")}</div>
    </div>
  );
}

function StatCard({ label, value, detail, accent }) {
  return (
    <article className={`stat-card ${accent || ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

export default function App() {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [cycles, setCycles] = useState(4);
  const [mode, setMode] = useState("adaptive");
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [maxWaitCycles, setMaxWaitCycles] = useState(3);
  const [pedestrianRoads, setPedestrianRoads] = useState([]);
  const [emergencyRoad, setEmergencyRoad] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [activeCycle, setActiveCycle] = useState(0);
  const [playbackStartedAt, setPlaybackStartedAt] = useState(null);
  const [playbackNow, setPlaybackNow] = useState(0);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (!Array.isArray(parsedHistory)) {
          throw new Error("Saved simulation history is invalid.");
        }
        setHistory(parsedHistory);
      }
    } catch (storageError) {
      setError(`Could not load browser history: ${storageError.message}`);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (storageError) {
      setError(`Could not save browser history: ${storageError.message}`);
    }
  }, [history, historyLoaded]);

  useEffect(() => {
    if (playbackStartedAt === null) return undefined;
    const timer = window.setInterval(() => setPlaybackNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [playbackStartedAt]);

  const playback = useMemo(() => (
    current && playbackStartedAt !== null
      ? getSignalPlayback(current.cycles, playbackNow - playbackStartedAt)
      : null
  ), [current, playbackNow, playbackStartedAt]);
  const isPlaying = playback !== null && playback.phase !== "complete";
  const displayedCycleIndex = playback?.cycleIndex
    ?? (playbackComplete && current ? current.cycles.length - 1 : activeCycle);
  const phase = playback?.phase ?? (playbackComplete ? "complete" : "green");
  const selectedCycle = current?.cycles?.[displayedCycleIndex] || null;
  const stats = current?.summary;

  useEffect(() => {
    if (playback?.phase === "complete") {
      setPlaybackStartedAt(null);
      setPlaybackComplete(true);
    }
  }, [playback]);

  function updateCount(road, value) {
    setCounts((previous) => ({ ...previous, [road]: Number(value) }));
  }

  function togglePedestrian(road) {
    setPedestrianRoads((previous) =>
      previous.includes(road) ? previous.filter((item) => item !== road) : [...previous, road],
    );
  }

  function startSimulation(event) {
    event.preventDefault();
    setError("");
    try {
      const result = {
        ...runSimulation({
          initialCounts: counts,
          cycles,
          mode,
          weights,
          maxWaitCycles,
          pedestrianRoads,
          emergencyRoad: emergencyRoad || null,
        }),
        _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
      };
      setCurrent(result);
      setActiveCycle(0);
      const startedAt = Date.now();
      setPlaybackNow(startedAt);
      setPlaybackStartedAt(startedAt);
      setPlaybackComplete(false);
      setHistory((previous) => [result, ...previous].slice(0, 10));
    } catch (simulationError) {
      setError(simulationError.message);
    }
  }

  function showRun(run) {
    setCurrent(run);
    setActiveCycle(0);
    setPlaybackStartedAt(null);
    setPlaybackComplete(false);
    setError("");
  }

  function showCycle(index) {
    setPlaybackStartedAt(null);
    setPlaybackComplete(false);
    setActiveCycle(index);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Flowstate home">
          <span className="brand-mark">F</span>
          <span>flowstate<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-meta">
          <span className="system-label">TRAFFIC INTELLIGENCE PLATFORM</span>
          <span className="connection connected">
            <i /> BROWSER MODE
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> INTERSECTION CONTROL / 01</span>
          <h1>Make every<br /><em>second</em> count.</h1>
          <p>Simulate adaptive signal timing and keep your intersection moving with decisions driven by live traffic demand.</p>
        </div>
        <div className="hero-stamp"><span>LIVE</span><strong>4-WAY</strong><small>JUNCTION</small></div>
      </section>

      {error && <div className="error-banner" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <section className="dashboard-grid">
        <aside className="control-panel panel">
          <div className="panel-heading">
            <div><span className="section-index">01 / CONFIGURE</span><h2>Simulation setup</h2></div>
            <span className="settings-glyph">⌘</span>
          </div>
          <form onSubmit={startSimulation}>
            <label className="field-label">CONTROL STRATEGY</label>
            <div className="mode-toggle" role="group" aria-label="Control strategy">
              <button type="button" className={mode === "adaptive" ? "selected" : ""} onClick={() => setMode("adaptive")}>Adaptive</button>
              <button type="button" className={mode === "fixed" ? "selected" : ""} onClick={() => setMode("fixed")}>Fixed-time</button>
            </div>
            <p className="field-hint">{mode === "adaptive" ? "Prioritizes demand, wait time, and crossing requests." : "Serves each approach in a consistent rotating order."}</p>

            <div className="field-row field-row-title">
              <label className="field-label">ARRIVING VEHICLES</label><span className="unit-label">VEHICLES / ROAD</span>
            </div>
            <div className="count-grid">
              {ROADS.map((road) => (
                <label className="count-field" key={road}>
                  <span>{road}</span>
                  <input aria-label={`${road} road vehicles`} type="number" min="0" max="100" value={counts[road]} onChange={(event) => updateCount(road, event.target.value)} />
                </label>
              ))}
            </div>

            <div className="field-row field-row-title"><label className="field-label">PEDESTRIAN REQUESTS</label><span className="unit-label">OPTIONAL</span></div>
            <div className="request-list">
              {ROADS.map((road) => (
                <label className="request-item" key={road}>
                  <span>{road}<small>Crosswalk</small></span>
                  <input type="checkbox" checked={pedestrianRoads.includes(road)} onChange={() => togglePedestrian(road)} />
                </label>
              ))}
            </div>

            <label className="field-label emergency-label" htmlFor="emergency-road">EMERGENCY OVERRIDE</label>
            <select id="emergency-road" value={emergencyRoad} onChange={(event) => setEmergencyRoad(event.target.value)}>
              <option value="">No active emergency</option>
              {ROADS.map((road) => <option value={road} key={road}>{road} approach</option>)}
            </select>

            <div className="field-row field-row-title cycle-heading"><label className="field-label" htmlFor="cycle-count">SIMULATION CYCLES</label><span className="cycle-value">{cycles.toString().padStart(2, "0")}</span></div>
            <input id="cycle-count" className="range-input" type="range" min="1" max="10" value={cycles} onChange={(event) => setCycles(Number(event.target.value))} />

            {mode === "adaptive" && (
              <details className="advanced-settings">
                <summary>Advanced priority settings</summary>
                <label className="slider-setting">Vehicle demand <input type="number" min="0" max="10" step="0.1" value={weights.vehicle_count} onChange={(event) => setWeights({ ...weights, vehicle_count: Number(event.target.value) })} /></label>
                <label className="slider-setting">Waiting time <input type="number" min="0" max="10" step="0.1" value={weights.waiting_time} onChange={(event) => setWeights({ ...weights, waiting_time: Number(event.target.value) })} /></label>
                <label className="slider-setting">Pedestrian priority <input type="number" min="0" max="10" step="0.1" value={weights.pedestrian} onChange={(event) => setWeights({ ...weights, pedestrian: Number(event.target.value) })} /></label>
                <label className="slider-setting">Starvation threshold <input type="number" min="1" max="20" value={maxWaitCycles} onChange={(event) => setMaxWaitCycles(Number(event.target.value))} /></label>
              </details>
            )}

            <button className="run-button" type="submit">RUN SIMULATION <span>↗</span></button>
            <p className="form-footnote">Runs are saved in this browser on this device.</p>
          </form>
        </aside>

        <section className="live-panel panel">
          <div className="panel-heading live-heading">
            <div><span className="section-index">02 / INTERSECTION</span><h2>Signal monitor</h2></div>
            <span className={`live-pill ${isPlaying ? "live-active" : ""}`}>
              <i /> {isPlaying
                ? `LIVE · CYCLE ${String(displayedCycleIndex + 1).padStart(2, "0")} / ${String(current.cycles.length).padStart(2, "0")}`
                : playbackComplete ? "SIMULATION COMPLETE"
                  : current ? `CYCLE ${String(displayedCycleIndex + 1).padStart(2, "0")} / ${String(current.cycles.length).padStart(2, "0")}` : "STANDBY"}
            </span>
          </div>
          {selectedCycle ? (
            <>
              <div className="monitor-status" data-phase={phase}>
                <span className="status-light" />
                <span>{phase === "complete"
                  ? "Simulation complete · all signals red"
                  : phase === "all-red"
                    ? "All signals red · safety gap"
                    : `${selectedCycle.selectedRoad} approach is ${phase}`}
                </span>
                <strong>
                  {phase === "complete" ? "DONE" : (playback?.secondsRemaining ?? selectedCycle.greenTimeSeconds)}
                  {phase !== "complete" && <small> SEC</small>}
                </strong>
              </div>
              <Junction
                cycle={selectedCycle}
                phase={phase}
                secondsRemaining={playback?.secondsRemaining ?? selectedCycle.greenTimeSeconds}
                isPlaying={isPlaying}
              />
              <div className="cycle-scrubber">
                <span>RUN CYCLE</span>
                <input aria-label="Choose cycle to view" type="range" min="0" max={current.cycles.length - 1} value={displayedCycleIndex} onChange={(event) => showCycle(Number(event.target.value))} />
                <span>{String(displayedCycleIndex + 1).padStart(2, "0")}<small> / {String(current.cycles.length).padStart(2, "0")}</small></span>
              </div>
            </>
          ) : (
            <div className="empty-monitor">
              <div className="empty-icon">✳</div>
              <strong>Awaiting simulation</strong>
              <p>Configure your intersection, then run a simulation to see signal decisions here.</p>
              <div className="empty-road"><span /><span /></div>
            </div>
          )}
          {stats && (
            <div className="stats-row">
              <StatCard label="VEHICLES PRIORITIZED" value={stats.totalVehiclesPrioritized} detail="on selected approaches" accent="accent-lime" />
              <StatCard label="AVG. GREEN TIME" value={`${stats.averageGreenTimeSeconds}s`} detail="per active approach" />
              <StatCard label="TOTAL SIGNAL TIME" value={`${stats.totalSignalTimeSeconds}s`} detail="green + transition" />
            </div>
          )}
        </section>
      </section>

      <section className="history-section panel">
        <div className="panel-heading history-heading">
          <div><span className="section-index">03 / ACTIVITY</span><h2>Simulation history</h2></div>
          <span className="history-count">{history.length} SAVED RUN{history.length === 1 ? "" : "S"}</span>
        </div>
        {current?.cycles?.length > 0 && (
          <div className="cycle-table-wrap">
            <table className="cycle-table">
              <thead><tr><th>CYCLE</th><th>GREEN APPROACH</th><th>VEHICLES</th><th>GREEN TIME</th><th>WAIT CYCLES</th></tr></thead>
              <tbody>
                {current.cycles.map((cycle, index) => (
                  <tr className={displayedCycleIndex === index ? "active-row" : ""} key={`${cycle.cycle}-${index}`} onClick={() => showCycle(index)}>
                    <td>{String(cycle.cycle).padStart(2, "0")}</td>
                    <td><span className="table-road-dot" />{cycle.selectedRoad}</td>
                    <td>{cycle.vehiclesOnSelectedRoad}</td><td>{cycle.greenTimeSeconds}s</td><td>{cycle.waitCyclesBeforeService}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="history-list">
          {history.length === 0 ? (
            <p className="history-empty">Your saved runs will appear here after the first simulation.</p>
          ) : history.map((run) => (
            <button className={`history-item ${current?._id === run._id ? "history-selected" : ""}`} key={run._id} onClick={() => showRun(run)}>
              <span className="history-mark">{run.mode === "adaptive" ? "A" : "F"}</span>
              <span className="history-run-name"><strong>{run.mode === "adaptive" ? "Adaptive control" : "Fixed-time baseline"}</strong><small>{new Date(run.createdAt).toLocaleString()} · {run.cycles.length} cycles</small></span>
              <span className="history-result">{run.summary.totalVehiclesPrioritized}<small> vehicles</small></span>
              <span className="history-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="footer"><span>FLOWSTATE <b>·</b> SMART INTERSECTION SYSTEM</span><span>BUILT FOR SAFER, SMARTER STREETS</span></footer>
    </main>
  );
}
