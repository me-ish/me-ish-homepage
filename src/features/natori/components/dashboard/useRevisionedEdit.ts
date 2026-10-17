"use client";
import { useRef, useState } from "react";
import { dirtyFields, NatoriEditConflictError } from "../../lib/editConflict";

export type EditSnapshot<T> = { revision: number | null | undefined; values: T };
/** A small edit session: reads never replace a draft; rebasing requires a separate click. */
export function useRevisionedEdit<T extends object>(snapshot: EditSnapshot<T>) {
  const [initial, setInitial] = useState(snapshot);
  const [base, setBase] = useState(snapshot);
  const [values, setValues] = useState(snapshot.values);
  const [latest, setLatest] = useState<EditSnapshot<T> | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const lock = useRef(false);
  const reset = (next: EditSnapshot<T>) => {
    setInitial(next); setBase(next); setValues(next.values); setLatest(null); setNeedsReview(false); setError(null);
  };
  const save = async (write: (patch: Partial<T>, revision: number | null | undefined) => Promise<EditSnapshot<T> | void>) => {
    if (lock.current || needsReview || reading) return false;
    const patch = dirtyFields(base.values, values);
    if (!Object.keys(patch).length) { setError("変更された項目がありません。"); return false; }
    lock.current = true; setSaving(true); setError(null);
    try {
      const result = await write(patch, base.revision);
      reset(result ?? { revision: base.revision, values });
      return true;
    } catch (err) {
      setNeedsReview(true); setLatest(null);
      setError(err instanceof NatoriEditConflictError ? err.message : "保存結果を確認できません。入力内容は保持しています。最新の保存済み内容を取得して確認してください。");
      return false;
    } finally { lock.current = false; setSaving(false); }
  };
  const compare = async (read: () => Promise<EditSnapshot<T>>) => {
    if (lock.current || reading) return;
    setReading(true);
    try { setLatest(await read()); setNeedsReview(true); setError(null); }
    catch { setError("最新の保存済み内容を取得できませんでした。入力内容は保持しています。"); }
    finally { setReading(false); }
  };
  const acknowledge = () => {
    if (!latest || saving || reading) return;
    const changes = dirtyFields(base.values, values);
    setValues({ ...latest.values, ...changes }); setBase(latest); setLatest(null); setNeedsReview(false); setError(null);
  };
  return { initial, base, values, setValues, latest, needsReview, error, setError, saving, reading, save, compare, acknowledge, reset,
    setField: <K extends keyof T>(key: K, value: T[K]) => { if (!lock.current) setValues(current => ({ ...current, [key]: value })); } };
}
