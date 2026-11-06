import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSyncLeaders } from "../client/src/features/session/utils/session-stats.ts";
import { analyzeRevealStats } from "../functions/src/vote-stats.ts";

const participants = (...ids) => ids.map((id) => ({ id, name: id, avatar: id }));
const groupIds = (result) => result.mostInSyncGroups
  .map((group) => group.map((participant) => participant.id).sort().join(""))
  .sort();

test("shared top-scoring partners do not imply a matching three-person group", () => {
  const result = computeSyncLeaders(participants("a", "b", "c"), {}, {
    "a|b": 4, "b|c": 4, "a|c": 1
  });
  assert.deepEqual(groupIds(result), ["ab", "bc"]);
});

test("fully matching groups are combined without redundant subgroups", () => {
  const result = computeSyncLeaders(participants("a", "b", "c", "d", "e"), {}, {
    "a|b": 4, "b|c": 4, "a|c": 4, "d|e": 4, "c|d": 1
  });
  assert.deepEqual(groupIds(result), ["abc", "de"]);
});

test("departed participants cannot hide the remaining participants' top pairs", () => {
  const result = computeSyncLeaders(participants("a", "b"), {}, {
    "a|departed": 10, "a|b": 2
  });
  assert.deepEqual(groupIds(result), ["ab"]);
});

test("equal individual match totals do not establish that people matched each other", () => {
  const result = computeSyncLeaders(participants("a", "b"), { a: 4, b: 4 }, {});
  assert.deepEqual(groupIds(result), []);
});

test("top pair members are never also labelled least in sync", () => {
  const result = computeSyncLeaders(participants("a", "b", "c"), { a: 2, b: 2, c: 3 }, {
    "a|b": 2, "a|c": 1, "b|c": 1
  });
  assert.deepEqual(groupIds(result), ["ab"]);
  assert.deepEqual(result.leastInSync, []);
});

test("participants tied for fewest matches are returned separately from top groups", () => {
  const result = computeSyncLeaders(participants("a", "b", "c", "d"), { a: 3, b: 3 }, { "a|b": 3 });
  assert.deepEqual(result.leastInSync.map((participant) => participant.id), ["c", "d"]);
});

test("empty and zero-match sessions have no leaders", () => {
  for (const members of [[], participants("a"), participants("a", "b")]) {
    assert.deepEqual(computeSyncLeaders(members, {}, {}), { mostInSyncGroups: [], leastInSync: [] });
  }
});

test("reveal statistics count actual matching pairs in separate vote groups", () => {
  const result = analyzeRevealStats([
    { participantId: "a", value: "5" },
    { participantId: "b", value: "5" },
    { participantId: "c", value: "8" },
    { participantId: "d", value: "8" },
    { participantId: "e", value: "13" }
  ]);
  assert.deepEqual(result.pairKeys, ["a|b", "c|d"]);
  assert.deepEqual(result.matchedUids, ["a", "b", "c", "d"]);
  assert.equal(result.closeOne, false);
});
