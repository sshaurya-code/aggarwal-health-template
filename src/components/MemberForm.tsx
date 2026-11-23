import { saveMember } from "@/app/actions";
import type { Member } from "@/lib/data";

const RELATIONS = ["Self", "Father", "Mother", "Spouse", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-sep py-1 pr-4 pl-4 last:border-0">
      <span className="w-28 shrink-0 text-[17px]">{label}</span>
      {children}
    </label>
  );
}

const input = "min-w-0 flex-1 bg-transparent py-2 text-right outline-none placeholder:text-ink3";

export function MemberForm({ member, members }: { member?: Member; members: Member[] }) {
  const others = members.filter((m) => m.id !== member?.id);
  return (
    <form action={saveMember}>
      {member && <input type="hidden" name="id" value={member.id} />}
      <div className="mt-2 card overflow-hidden rounded-2xl bg-card">
        <Field label="Name">
          <input name="name" required defaultValue={member?.name} placeholder="Full name" className={input} autoComplete="off" />
        </Field>
        <Field label="Relation">
          <input name="relation" list="relations" defaultValue={member?.relation ?? ""} placeholder="Father, Self…" className={input} />
          <datalist id="relations">
            {RELATIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Date of birth">
          <input name="dob" type="date" defaultValue={member?.dob ?? ""} className={input} />
        </Field>
        <Field label="Sex">
          <select name="sex" defaultValue={member?.sex ?? ""} className={`${input} appearance-none`} dir="rtl">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Blood group">
          <select name="blood_group" defaultValue={member?.blood_group ?? ""} className={`${input} appearance-none`} dir="rtl">
            <option value="">—</option>
            {BLOOD.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Height (cm)">
          <input name="height_cm" type="number" inputMode="decimal" step="0.1" defaultValue={member?.height_cm ?? ""} placeholder="170" className={input} />
        </Field>
      </div>

      <p className="mt-7 mb-2 px-1 text-[20px] font-bold tracking-tight">Family tree</p>
      <div className="card overflow-hidden rounded-2xl bg-card">
        <Field label="Married to">
          <select name="spouse_id" defaultValue={member?.spouse_id ?? ""} className={`${input} appearance-none`} dir="rtl">
            <option value="">—</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Child of">
          <select name="parent_id" defaultValue={member?.parent_id ?? ""} className={`${input} appearance-none`} dir="rtl">
            <option value="">—</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.spouse_id && members.find((s) => s.id === m.spouse_id) ? ` & ${members.find((s) => s.id === m.spouse_id)!.name}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-2 px-1 text-[13px] text-ink2">Pick either parent; the other is their partner. This builds the home screen and the health map.</p>

      <p className="mt-7 mb-2 px-1 text-[20px] font-bold tracking-tight">Medical</p>
      <div className="card overflow-hidden rounded-2xl bg-card">
        <Field label="Conditions">
          <input name="conditions" defaultValue={member?.conditions.join(", ")} placeholder="Diabetes, BP…" className={input} />
        </Field>
        <Field label="Allergies">
          <input name="allergies" defaultValue={member?.allergies.join(", ")} placeholder="Penicillin…" className={input} />
        </Field>
        <label className="block px-4 py-3">
          <span className="text-[17px]">Notes</span>
          <textarea name="notes" defaultValue={member?.notes ?? ""} rows={3} placeholder="Family history, surgeries, regular doctor…" className="mt-1 w-full resize-none bg-transparent outline-none placeholder:text-ink3" />
        </label>
      </div>
      <p className="mt-2 px-1 text-[13px] text-ink2">Separate conditions and allergies with commas.</p>

      <button className="tap mt-6 h-[50px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-white">{member ? "Save" : "Add to family"}</button>
    </form>
  );
}
