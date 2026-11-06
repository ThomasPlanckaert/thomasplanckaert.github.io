import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, mock } from "node:test";

const require = createRequire(import.meta.url);
const admin = require("../functions/lib/admin.js");
const { handleRevealVotes, handleUpdateSessionSettings } = require("../functions/lib/moderator.js");

function room(data) {
  const updates = [];
  const ref = {
    get: async () => ({ exists: true, data: () => data }),
    update: async (value) => { updates.push(value); Object.assign(data, value); }
  };
  const db = {
    doc: () => ref,
    collection: (path) => path,
    runTransaction: async (action) => action({
      get: async (target) => {
        if (target === ref) return ref.get();
        if (target.endsWith("participants")) return { docs: ["a", "b"].map((id) => ({
          id, data: () => ({ lastSeen: { toMillis: () => Date.now() } })
        })) };
        return { docs: ["a", "b"].map((id) => ({ id, data: () => ({ value: "5" }) })) };
      },
      update: (_, value) => { updates.push(value); Object.assign(data, value); }
    })
  };
  mock.method(admin, "getAdminDb", () => db);
  return updates;
}

test("repeating a reveal does not increment statistics or consensus streak twice", async () => {
  const data = { moderatorUid: "a", revealed: false, round: 1, consensusStreak: 0 };
  const updates = room(data);
  try {
    const request = { auth: { uid: "a" }, data: { roomCode: "TEST" } };
    await handleRevealVotes(request);
    await handleRevealVotes(request);
    assert.equal(updates.length, 1);
    assert.equal(data.consensusStreak, 1);
    assert.deepEqual(data.statsMatchCounts, { a: 1, b: 1 });
    assert.deepEqual(data.statsPairCounts, { "a|b": 1 });
  } finally { mock.restoreAll(); }
});

test("only the original creator can rename a room after moderator transfer", async () => {
  const updates = room({ moderatorUid: "b", creatorUid: "a" });
  try {
    await assert.rejects(
      handleUpdateSessionSettings({ auth: { uid: "b" }, data: { roomCode: "TEST", title: "Changed" } }),
      { code: "permission-denied" }
    );
    await handleUpdateSessionSettings({ auth: { uid: "a" }, data: { roomCode: "TEST", title: " New name " } });
    assert.deepEqual(updates, [{ title: "New name" }]);
  } finally { mock.restoreAll(); }
});

test("legacy rooms allow their creator/moderator to rename but reject blank titles", async () => {
  const updates = room({ moderatorUid: "a" });
  try {
    await assert.rejects(
      handleUpdateSessionSettings({ auth: { uid: "a" }, data: { roomCode: "TEST", title: "  " } }),
      { code: "invalid-argument" }
    );
    await handleUpdateSessionSettings({ auth: { uid: "a" }, data: { roomCode: "TEST", title: "Planning" } });
    assert.deepEqual(updates, [{ title: "Planning" }]);
  } finally { mock.restoreAll(); }
});
