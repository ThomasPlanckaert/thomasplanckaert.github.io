import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSessionStats } from "../src/features/session/utils/session-stats.ts";

const participants = ["a", "b", "c", "d"].map((id) => ({ id, name: id, avatar: id }));
const reveal = (votes, participantCount = participants.length) => ({ votes, participantCount });

test("matching partners do not imply a matching three-person group", () => {
  const stats = computeSessionStats(participants, [
    reveal({ a: "5", b: "5", c: "8", d: "13" }),
    reveal({ a: "8", b: "5", c: "5", d: "13" })
  ]);
  assert.deepEqual(stats.mostInSyncPairs.map((pair) => pair.participants.map((participant) => participant.id)), [["a", "b"], ["b", "c"]]);
  assert.deepEqual(stats.leastInSync.map((participant) => participant.id), ["d"]);
});

test("consensus requires all participants at the time of reveal", () => {
  const stats = computeSessionStats(participants, [
    reveal({ a: "5", b: "5" }),
    reveal({ a: "8", b: "8", c: "8", d: "8" }),
    reveal({ a: "13", b: "13", c: "13", d: "21" })
  ]);
  assert.equal(stats.consensuses, 1);
  assert.equal(stats.closeOnes, 1);
});

test("departed participants cannot hide remaining participants' top pairs", () => {
  const stats = computeSessionStats(participants.slice(0, 2), [
    reveal({ a: "5", c: "5" }), reveal({ a: "5", c: "5" }), reveal({ a: "8", b: "8" })
  ]);
  assert.equal(stats.mostInSyncPairs.length, 1);
  assert.deepEqual(stats.mostInSyncPairs[0].participants.map((participant) => participant.id), ["a", "b"]);
});

test("empty and solo sessions have no matching pairs", () => {
  assert.equal(computeSessionStats([], []).mostInSyncPairs.length, 0);
  assert.equal(computeSessionStats(participants.slice(0, 1), [reveal({ a: "?" }, 1)]).mostInSyncPairs.length, 0);
});
