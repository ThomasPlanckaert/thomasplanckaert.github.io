import type { Participant } from "../types/session";

export interface SessionStats {
  consensuses: number;
  closeOnes: number;
  matchCounts: Record<string, number>;
  pairCounts: Record<string, number>;
}

export interface SyncLeaders {
  mostInSyncGroups: Participant[][];
  leastInSync: Participant[];
}

function participantMap(participants: Participant[]): Map<string, Participant> {
  return new Map(participants.map((p) => [p.id, p]));
}

function fullyConnectedGroups(adjacency: Map<string, Set<string>>): string[][] {
  const groups: string[][] = [];
  // Maximal cliques: every member must have a top-scoring match with every other member.
  function visit(group: string[], candidates: Set<string>, excluded: Set<string>) {
    if (candidates.size === 0 && excluded.size === 0) {
      if (group.length >= 2) groups.push(group);
      return;
    }
    const pivot = [...candidates, ...excluded].sort((a, b) =>
      [...candidates].filter((id) => adjacency.get(b)?.has(id)).length -
      [...candidates].filter((id) => adjacency.get(a)?.has(id)).length
    )[0];
    for (const id of [...candidates].filter((id) => !adjacency.get(pivot)?.has(id))) {
      const neighbors = adjacency.get(id)!;
      visit(
        [...group, id],
        new Set([...candidates].filter((candidate) => neighbors.has(candidate))),
        new Set([...excluded].filter((candidate) => neighbors.has(candidate)))
      );
      candidates.delete(id);
      excluded.add(id);
    }
  }
  visit([], new Set(adjacency.keys()), new Set());
  return groups;
}

function groupsFromPairCounts(
  participants: Participant[],
  pairCounts: Record<string, number>
): Participant[][] {
  const byId = participantMap(participants);
  const pairs = Object.entries(pairCounts).filter(([key, count]) => {
    const ids = key.split("|");
    return ids.length === 2 && ids[0] !== ids[1] && ids.every((id) => byId.has(id)) && count > 0;
  });
  if (pairs.length === 0) return [];

  const maxPairCount = Math.max(...pairs.map(([, count]) => count));
  if (maxPairCount === 0) return [];

  const adjacency = new Map<string, Set<string>>();

  for (const [key, count] of pairs) {
    if (count !== maxPairCount) continue;
    const [a, b] = key.split("|");
    if (!byId.has(a) || !byId.has(b)) continue;

    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  return fullyConnectedGroups(adjacency)
    .map((uids) =>
      uids.map((id) => byId.get(id)).filter((p): p is Participant => p != null)
    )
    .filter((group) => group.length > 0)
    .sort((a, b) => b.length - a.length);
}

export function computeSyncLeaders(
  participants: Participant[],
  matchCounts: Record<string, number>,
  pairCounts: Record<string, number>
): SyncLeaders {
  if (participants.length === 0) {
    return { mostInSyncGroups: [], leastInSync: [] };
  }

  const mostInSyncGroups = groupsFromPairCounts(participants, pairCounts);

  const mostInSyncIds = new Set(mostInSyncGroups.flat().map((p) => p.id));
  const scored = participants.map((p) => ({
    participant: p,
    count: matchCounts[p.id] ?? 0
  }));

  const min = Math.min(...scored.map((s) => s.count));
  const max = Math.max(...scored.map((s) => s.count));

  let leastInSync: Participant[] = [];
  if (min < max) {
    leastInSync = scored
      .filter((s) => s.count === min && !mostInSyncIds.has(s.participant.id))
      .map((s) => s.participant);
  }

  return { mostInSyncGroups, leastInSync };
}
