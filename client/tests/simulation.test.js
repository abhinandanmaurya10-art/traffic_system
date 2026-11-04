import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGreenTime,
  chooseRoad,
  fixedTimeChoice,
  getSignalPlayback,
  PLAYBACK_MS_PER_SECOND,
  runSimulation,
  updateStarvationCounters,
} from "../src/simulation.js";

test("green duration is bounded by the configured minimum and maximum", () => {
  assert.equal(calculateGreenTime(0), 5);
  assert.equal(calculateGreenTime(100), 30);
  assert.equal(calculateGreenTime(1000), 30);
});

test("adaptive scheduler serves a starved road before ordinary score comparisons", () => {
  const states = {
    North: { vehicleCount: 5, waitCycles: 0, pedestrianRequest: false, emergency: false },
    South: { vehicleCount: 3, waitCycles: 4, pedestrianRequest: false, emergency: false },
  };
  assert.equal(chooseRoad(states, { vehicle_count: 1, waiting_time: 0, pedestrian: 0 }), "South");
});

test("emergency requests take priority over starvation and traffic scores", () => {
  const states = {
    North: { vehicleCount: 5, waitCycles: 8, pedestrianRequest: false, emergency: false },
    South: { vehicleCount: 0, waitCycles: 0, pedestrianRequest: false, emergency: true },
  };
  assert.equal(chooseRoad(states), "South");
});

test("fixed-time scheduler rotates in the supplied road order", () => {
  const roads = ["North", "South", "East", "West"];
  assert.equal(fixedTimeChoice(roads), "North");
  assert.equal(fixedTimeChoice(roads, 0), "South");
  assert.equal(fixedTimeChoice(roads, 3), "North");
});

test("live playback advances through green, yellow, all-red, and subsequent cycles", () => {
  const cycles = [
    { selectedRoad: "North", greenTimeSeconds: 5 },
    { selectedRoad: "South", greenTimeSeconds: 10 },
  ];
  const firstCycleDuration = (5 + 3 + 1) * PLAYBACK_MS_PER_SECOND;

  assert.deepEqual(getSignalPlayback(cycles, 0), {
    cycleIndex: 0,
    phase: "green",
    secondsRemaining: 5,
  });
  assert.equal(getSignalPlayback(cycles, 5 * PLAYBACK_MS_PER_SECOND).phase, "yellow");
  assert.equal(getSignalPlayback(cycles, 8 * PLAYBACK_MS_PER_SECOND).phase, "all-red");
  assert.deepEqual(getSignalPlayback(cycles, firstCycleDuration), {
    cycleIndex: 1,
    phase: "green",
    secondsRemaining: 10,
  });
  assert.equal(getSignalPlayback(cycles, Infinity).phase, "complete");
});

test("serving a road resets its wait and clears served requests", () => {
  const states = {
    North: { vehicleCount: 0, waitCycles: 2, pedestrianRequest: true, emergency: true },
    South: { vehicleCount: 0, waitCycles: 0, pedestrianRequest: false, emergency: false },
  };
  updateStarvationCounters(states, "North");
  assert.deepEqual(states.North, {
    vehicleCount: 0,
    waitCycles: 0,
    pedestrianRequest: false,
    emergency: false,
  });
  assert.equal(states.South.waitCycles, 1);
});

test("simulation records selected roads, metrics, and randomized follow-up traffic", () => {
  const result = runSimulation(
    {
      initialCounts: { North: 10, South: 6, East: 18, West: 8 },
      cycles: 2,
      mode: "fixed",
    },
    () => 0.5,
  );
  assert.deepEqual(result.cycles.map((cycle) => cycle.selectedRoad), ["North", "South"]);
  assert.equal(result.cycles[0].counts.North, 10);
  assert.equal(result.cycles[1].counts.East, 20);
  assert.equal(result.summary.totalVehiclesPrioritized, 30);
  assert.equal(result.summary.averageGreenTimeSeconds, 12.5);
  assert.equal(result.summary.totalSignalTimeSeconds, 33);
});

test("emergency overrides the fixed-time schedule", () => {
  const result = runSimulation({
    initialCounts: { North: 10, South: 6, East: 18, West: 8 },
    cycles: 1,
    mode: "fixed",
    emergencyRoad: "West",
  });
  assert.equal(result.cycles[0].selectedRoad, "West");
  assert.equal(result.cycles[0].emergencyRoad, "West");
});

test("simulation rejects invalid traffic and cycle values", () => {
  assert.throws(
    () => runSimulation({ initialCounts: { North: -1, South: 0, East: 0, West: 0 } }),
    /North road traffic/,
  );
  assert.throws(
    () => runSimulation({ initialCounts: { North: 0, South: 0, East: 0, West: 0 }, cycles: 11 }),
    /Cycle count/,
  );
});
