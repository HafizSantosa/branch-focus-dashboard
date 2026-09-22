import assert from "node:assert/strict";
import test from "node:test";
import { buildConstructionPipeline } from "../src/lib/dashboard-metrics";

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
