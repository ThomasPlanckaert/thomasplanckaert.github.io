import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";

export function RoomTitle({ title, editable, onSave }: {
  title: string;
  editable: boolean;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  if (editing && editable) return (
    <form className="my-2 flex flex-wrap gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (!draft.trim()) return;
      onSave(draft.trim());
      setEditing(false);
    }} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }}>
      <Input autoFocus aria-label="Room name" maxLength={200} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <Button type="submit" size="sm" disabled={!draft.trim()}>Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
    </form>
  );
  return (
    <div className="flex items-center gap-2">
      <h1 className="break-words text-2xl font-bold text-white">{title}</h1>
      {editable && <Button size="sm" variant="ghost" aria-label="Edit room name" onClick={() => { setDraft(title); setEditing(true); }}><Pencil size={16} /></Button>}
    </div>
  );
}
