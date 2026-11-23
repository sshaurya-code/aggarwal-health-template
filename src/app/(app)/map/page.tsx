import Link from "next/link";
import { PANEL_STYLE } from "@/components/theme";
import { Avatar, Empty, IconTile, LargeTitle, Page, Section } from "@/components/ui";
import { getMembers, type Member } from "@/lib/data";
import { family, screeningHint, type Unit } from "@/lib/family";

const first = (m: Member) => m.name.split(" ")[0]!;
const list = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

function Person({ m, size }: { m: Member; size: number }) {
  return (
    <Link href={`/m/${m.id}`} className="tap flex w-[60px] flex-col items-center gap-0.5 text-center">
      <Avatar name={m.name} size={size} />
      <span className="w-full truncate text-[12px] font-semibold">{first(m)}</span>
      {m.conditions.slice(0, 2).map((c) => (
        <span key={c} className="max-w-full truncate rounded-md bg-warn/15 px-1 text-[10px] font-semibold text-warn">
          {c}
        </span>
      ))}
      {m.conditions.length > 2 && <span className="text-[10px] text-ink2">+{m.conditions.length - 2}</span>}
    </Link>
  );
}

function Branch({ node, tree, depth }: { node: Unit | Member; tree: ReturnType<typeof family>; depth: number }) {
  const size = depth === 0 ? 46 : depth === 1 ? 40 : 34;
  if (!("heads" in node)) return <li><Person m={node} size={size} /></li>;
  const below = tree.childUnits(node);
  return (
    <li>
      <div className="card flex items-start gap-0.5 rounded-2xl bg-card px-1.5 py-2">
        {node.heads.map((h, i) => (
          <div key={h.id} className="flex items-start">
            {i > 0 && <span className="mt-3 text-[11px] text-[#ff2d55]" aria-label="married to">♥</span>}
            <Person m={h} size={size} />
          </div>
        ))}
      </div>
      {below.length > 0 && (
        <ul>
          {below.map((c) => (
            <Branch key={"heads" in c ? c.key : c.id} node={c} tree={tree} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function MapPage() {
  const members = await getMembers();
  const tree = family(members);
  const roots = tree.units.filter((u) => u.elders);

  // For every condition a parent or grandparent has, who it is passed down to.
  const runs = new Map<string, { label: string; carriers: Set<Member>; heirs: Set<Member> }>();
  for (const m of members) {
    for (const a of tree.ancestors(m)) {
      for (const c of a.conditions) {
        const key = c.trim().toLowerCase();
        if (!key || m.conditions.some((x) => x.trim().toLowerCase() === key)) continue;
        const entry = runs.get(key) ?? { label: c.trim(), carriers: new Set(), heirs: new Set() };
        entry.carriers.add(a);
        entry.heirs.add(m);
        runs.set(key, entry);
      }
    }
  }
  for (const [key, e] of runs) for (const m of members) if (m.conditions.some((x) => x.trim().toLowerCase() === key)) e.carriers.add(m);
  const anyConditions = members.some((m) => m.conditions.length);

  return (
    <Page>
      <LargeTitle title="Health map" subtitle="Conditions across the generations" back={{ href: "/", label: "Family" }} />
      {roots.length ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <ul className="ftree mx-auto w-max min-w-full">
            {roots.map((u) => (
              <Branch key={u.key} node={u} tree={tree} depth={0} />
            ))}
          </ul>
        </div>
      ) : (
        <Empty title="No family tree yet" body="Open a profile, tap Edit and set who they are married to and whose child they are." />
      )}

      {runs.size > 0 && (
        <Section title="Runs in the family" icon={PANEL_STYLE.Inflammation} bare footer="Family history is a reason to ask the doctor, not a diagnosis.">
          <div className="space-y-2.5">
            {[...runs.values()].map((e) => (
              <div key={e.label} className="card rounded-2xl bg-card p-3.5">
                <p className="text-[17px] font-semibold capitalize">{e.label}</p>
                <p className="mt-0.5 text-[15px] text-ink2">
                  {list([...e.carriers].map(first))} {e.carriers.size === 1 ? "has" : "have"} it. For {list([...e.heirs].map(first))}, ask the doctor about {screeningHint(e.label)}.
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!anyConditions && roots.length > 0 && (
        <div className="card mt-6 flex items-start gap-3 rounded-2xl bg-card p-4">
          <IconTile style={PANEL_STYLE.Inflammation} size={32} />
          <p className="text-[15px] text-ink2">
            No conditions recorded yet. Tap anyone above, then <b className="text-ink">Edit</b>, and add conditions such as diabetes, BP or thyroid. The map then shows what runs in the family and who should be screened.
          </p>
        </div>
      )}
    </Page>
  );
}
