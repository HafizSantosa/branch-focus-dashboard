import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConstructionPipeline,
  buildKpiMetrics,
  createDefaultFilterState,
  createEmptyFilterState,
  getDefaultPrioFlags,
  isDefaultFilterState,
} from "../src/lib/dashboard-metrics";

const records = [
  {
    statusKonstruksi: "01. Persiapan",
    pt: "PT2",
    portPlan: 100,
    portReal: 0,
  },
  {
    statusKonstruksi: "01. Persiapan",
    pt: "",
    portPlan: 50,
    portReal: 0,
  },
  {
    statusKonstruksi: "05. Go Live",
    pt: "PT3",
    portPlan: 80,
    portReal: 60,
  },
];

test("pipeline includes staged records whose PT classification is missing", () => {
  const pipeline = buildConstructionPipeline(records, "port");
  const preparation = pipeline.items.find(
    (item) => item.stage === "01. Persiapan"
  );
  const goLive = pipeline.items.find((item) => item.stage === "05. Go Live");

  assert.deepEqual(
    {
      pt2: preparation?.pt2,
      pt3: preparation?.pt3,
      unassigned: preparation?.unassigned,
      total: preparation?.total,
    },
    { pt2: 100, pt3: 0, unassigned: 50, total: 150 }
  );
  assert.equal(goLive?.total, 60);
  assert.equal(pipeline.unassignedTotal, 50);
  assert.equal(pipeline.grandSum, 210);
});

test("LOP pipeline counts every staged record regardless of PT", () => {
  const pipeline = buildConstructionPipeline(records, "lop");
  const preparation = pipeline.items.find(
    (item) => item.stage === "01. Persiapan"
  );

  assert.equal(preparation?.total, 2);
  assert.equal(preparation?.unassigned, 1);
  assert.equal(pipeline.grandSum, 3);
});

test("getDefaultPrioFlags selects Agustus and September from available filter options", () => {
  const flags = ["Prio Agustus", "Prio September", "Prio Oktober"];
  assert.deepEqual(getDefaultPrioFlags(flags), [
    "Prio Agustus",
    "Prio September",
  ]);
});

test("getDefaultPrioFlags falls back to Agustus and September when options are empty or omitted", () => {
  assert.deepEqual(getDefaultPrioFlags(), [
    "Prio Agustus",
    "Prio September",
  ]);
  assert.deepEqual(getDefaultPrioFlags([]), [
    "Prio Agustus",
    "Prio September",
  ]);
});

test("createDefaultFilterState initializes with default priority months and branchFokus true", () => {
  const defaultState = createDefaultFilterState({
    prioFlag: ["Prio Agustus", "Prio September", "Prio Oktober"],
  });

  assert.deepEqual(defaultState.prioFlag, ["Prio Agustus", "Prio September"]);
  assert.equal(defaultState.branchFokus, true);
  assert.equal(defaultState.pt.length, 0);
  assert.equal(defaultState.search, "");
});

test("isDefaultFilterState detects when filters match default vs modified", () => {
  const options = {
    prioFlag: ["Prio Agustus", "Prio September", "Prio Oktober"],
  };
  const defaultState = createDefaultFilterState(options);
  assert.equal(isDefaultFilterState(defaultState, options), true);

  const clearedState = createEmptyFilterState();
  assert.equal(isDefaultFilterState(clearedState, options), false);

  const modifiedState = {
    ...defaultState,
    area: ["AREA 1"],
  };
  assert.equal(isDefaultFilterState(modifiedState, options), false);
});

test("Port Go Live counts Port Real even when construction status is not Go Live", () => {
  const metrics = buildKpiMetrics([
    {
      statusKonstruksi: "00. Propose Drop",
      portPlan: 64,
      portReal: 64,
    },
    {
      statusKonstruksi: "05. Go Live",
      portPlan: 96,
      portReal: 0,
    },
  ]);

  assert.equal(metrics.goLivePort, 64);
  assert.equal(metrics.goLiveLop, 1);
  assert.equal(metrics.totalPortReal, 64);
});
