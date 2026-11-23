import type { Doc } from "@/lib/data";
import { KIND_STYLE } from "./theme";
import { IconTile, KIND_LABEL, NameTag, Row } from "./ui";
import { docDateLabel, ExpiryChip, vaultLine } from "./VaultDetails";

export function DocRow({ doc, owner }: { doc: Doc; owner: string | null }) {
  const line = doc.category === "health" ? [KIND_LABEL[doc.kind], docDateLabel(doc), doc.lab_name] : vaultLine(doc);
  return (
    <Row href={`/d/${doc.id}`}>
      <div className="flex items-center gap-3">
        <IconTile style={KIND_STYLE[doc.kind] ?? KIND_STYLE.other!} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px]">{doc.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink2">
            <NameTag name={owner} />
            <span className="truncate">{line.filter(Boolean).join(" · ")}</span>
          </p>
        </div>
        <ExpiryChip doc={doc} />
      </div>
    </Row>
  );
}
