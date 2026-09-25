import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinishStatusDistribution,
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
test("Finish Instalasi status distribution counts Port and LOP and normalizes missing statuses", () => {
  const data = [
    { statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "Belum Ada Jadwal Integrasi", portPlan: 24 },
    { statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "Belum Ada Jadwal Integrasi", portPlan: 48 },
    { statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "  ", portPlan: 8 },
    { statusKonstruksi: "01. Persiapan", statusFiNyGolive: "Belum Ada Jadwal Integrasi", portPlan: 100 },
  ];

  assert.deepEqual(buildFinishStatusDistribution(data, "port"), {
    items: [
      { name: "Belum Ada Jadwal Integrasi", value: 72 },
      { name: "Status Belum Diisi", value: 8 },
    ],
    total: 80,
  });
  assert.deepEqual(buildFinishStatusDistribution(data, "lop"), {
    items: [
      { name: "Belum Ada Jadwal Integrasi", value: 2 },
      { name: "Status Belum Diisi", value: 1 },
    ],
    total: 3,
  });
});

test("Finish Instalasi distribution handles legacy records and combines labels beyond seven", () => {
  const legacy = {
    statusKonstruksi: "04. Finish Instalasi",
    portPlan: 3,
  } as Parameters<typeof buildFinishStatusDistribution>[0][number];
  const records = [
    legacy,
    ...Array.from({ length: 8 }, (_, index) => ({
      statusKonstruksi: "04. Finish Instalasi",
      statusFiNyGolive: `Status ${String(index + 1).padStart(2, "0")}`,
      portPlan: 10 - index,
    })),
  ];

  const result = buildFinishStatusDistribution(records, "port");
  assert.equal(result.total, 55);
  assert.deepEqual(result.items.slice(0, 7).map(({ name, value }) => ({ name, value })), [
    { name: "Status 01", value: 10 },
    { name: "Status 02", value: 9 },
    { name: "Status 03", value: 8 },
    { name: "Status 04", value: 7 },
    { name: "Status 05", value: 6 },
    { name: "Status 06", value: 5 },
    { name: "Status 07", value: 4 },
  ]);
  assert.deepEqual(result.items[7], { name: "Status Lainnya", value: 6 });
  assert.deepEqual(buildFinishStatusDistribution([], "port"), { items: [], total: 0 });
  assert.deepEqual(
    buildFinishStatusDistribution(
      [{ statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "", portPlan: 0 }],
      "port"
    ),
    { items: [{ name: "Status Belum Diisi", value: 0 }], total: 0 }
  );
  assert.deepEqual(
    buildFinishStatusDistribution(
      [
        { statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "Zebra", portPlan: 1 },
        { statusKonstruksi: "04. Finish Instalasi", statusFiNyGolive: "Alpha", portPlan: 1 },
      ],
      "port"
    ).items.map(({ name }) => name),
    ["Alpha", "Zebra"]
  );
});
