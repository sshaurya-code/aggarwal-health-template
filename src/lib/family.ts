import type { Member } from "./data";

/** A couple (or single parent) with the children who don't yet head a family of their own. */
export type Unit = { key: string; heads: Member[]; children: Member[]; elders: boolean; title: string };

const first = (m: Member) => m.name.split(" ")[0]!;

export function family(members: Member[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const spouse = (m: Member) => (m.spouse_id ? byId.get(m.spouse_id) : undefined);
  const parents = (m: Member) => {
    const p = m.parent_id ? byId.get(m.parent_id) : undefined;
    const other = p && spouse(p);
    return [p, other].filter((x): x is Member => !!x);
  };
  const childrenOf = (heads: Member[]) => members.filter((c) => heads.some((h) => c.parent_id === h.id));

  const units: Unit[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.id)) continue;
    const s = spouse(m);
    const heads = [m, s].filter((x): x is Member => !!x);
    const kids = childrenOf(heads);
    if (!kids.length && !s) continue;
    heads.forEach((h) => seen.add(h.id));
    // The partner born into the family names the branch; the in-law marries into it.
    const blood = heads.find((h) => h.parent_id) ?? heads[0]!;
    const elders = heads.every((h) => !h.parent_id);
    units.push({
      key: heads.map((h) => h.id).join("+"),
      heads: blood === heads[0] ? heads : [blood, ...heads.filter((h) => h !== blood)],
      children: [],
      elders,
      title: elders ? heads.map(first).join(" & ") : `${first(blood)}'s family`,
    });
  }
  const headOf = new Map(units.flatMap((u) => u.heads.map((h) => [h.id, u])));
  for (const u of units) u.children = childrenOf(u.heads).filter((c) => !headOf.has(c.id));
  // Eldest generation first, then each branch in the order its founder was added.
  const depth = (m: Member): number => (m.parent_id && byId.get(m.parent_id) ? 1 + depth(byId.get(m.parent_id)!) : 0);
  units.sort((a, b) => depth(a.heads[0]!) - depth(b.heads[0]!));
  const placed = new Set(units.flatMap((u) => [...u.heads, ...u.children].map((m) => m.id)));

  return {
    units,
    others: members.filter((m) => !placed.has(m.id)),
    parents,
    spouse,
    unitOf: (m: Member) => headOf.get(m.id),
    /** Parents and grandparents, i.e. the people whose health history is inherited. */
    ancestors: (m: Member) => {
      const ps = parents(m);
      return [...ps, ...ps.flatMap(parents)];
    },
    childUnits: (u: Unit) => childrenOf(u.heads).map((c) => headOf.get(c.id) ?? c),
  };
}

/** What to ask the doctor about when a condition runs in the family. */
export function screeningHint(condition: string) {
  const c = condition.toLowerCase();
  if (/diabet|sugar/.test(c)) return "an HbA1c or fasting sugar test";
  if (/\bbp\b|pressure|hypertens/.test(c)) return "regular blood pressure checks";
  if (/thyroid/.test(c)) return "a TSH test";
  if (/heart|cardiac|cholesterol|lipid/.test(c)) return "a lipid profile";
  if (/kidney|renal/.test(c)) return "a kidney function test";
  return "whether earlier screening makes sense";
}
