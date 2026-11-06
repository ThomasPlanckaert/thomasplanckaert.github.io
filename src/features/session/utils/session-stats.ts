import type { Participant, PokerSession } from "../types/session";

export function computeSessionStats(participants: Participant[], history: NonNullable<PokerSession["revealHistory"]>) {
  const pairCounts = new Map<string, { participants: Participant[]; count: number }>();
  const matchCounts = new Map(participants.map((participant) => [participant.id, 0]));
  let consensuses = 0;
  let closeOnes = 0;

  for (const { votes, participantCount } of history) {
    const values = Object.values(votes);
    const groups = new Map<string, string[]>();
    for (const [id, value] of Object.entries(votes)) {
      const members = groups.get(value) ?? [];
      members.push(id);
      groups.set(value, members);
    }
    if (values.length > 0 && values.length === participantCount && groups.size === 1) consensuses++;
    else if (groups.size > 1 && Math.max(...[...groups.values()].map((group) => group.length)) / values.length >= 0.75) closeOnes++;

    for (const participant of participants) {
      const value = votes[participant.id];
      if (value != null && (groups.get(value)?.length ?? 0) >= 2) {
        matchCounts.set(participant.id, matchCounts.get(participant.id)! + 1);
      }
    }
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i];
        const b = participants[j];
        if (votes[a.id] == null || votes[a.id] !== votes[b.id]) continue;
        const key = [a.id, b.id].sort().join("|");
        const pair = pairCounts.get(key) ?? { participants: [a, b], count: 0 };
        pair.count++;
        pairCounts.set(key, pair);
      }
    }
  }

  const maxPairCount = Math.max(0, ...[...pairCounts.values()].map((pair) => pair.count));
  const mostInSyncPairs = [...pairCounts.values()].filter((pair) => pair.count === maxPairCount);
  const topPairIds = new Set(mostInSyncPairs.flatMap((pair) => pair.participants.map((participant) => participant.id)));
  const minMatches = Math.min(...matchCounts.values());
  const maxMatches = Math.max(0, ...matchCounts.values());
  const leastInSync = minMatches < maxMatches
    ? participants.filter((participant) => matchCounts.get(participant.id) === minMatches && !topPairIds.has(participant.id))
    : [];
  return { consensuses, closeOnes, mostInSyncPairs, leastInSync, reveals: history.length };
}
