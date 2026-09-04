"use client";

import { useEffect, useState } from "react";
import {
  getNatoriProjectActivityLabel,
  type NatoriProjectActivity,
} from "@/features/natori/lib/projectActivity";
import type { NatoriInquiryNoteView } from "@/features/natori/lib/inquiryNoteView";

type ProjectActivityTimelineProps = {
  projectId: string;
  legacyLogs: NatoriInquiryNoteView["logs"];
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLegacyDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}/${month}/${day}`;
}

export default function ProjectActivityTimeline({
  projectId,
  legacyLogs,
}: ProjectActivityTimelineProps) {
  const [activity, setActivity] = useState<NatoriProjectActivity[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setActivity(null);
    setFailed(false);

    void fetch(
      `/api/natori/admin/project-activity?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`activity_${response.status}`);
        return response.json() as Promise<{ activity?: NatoriProjectActivity[] }>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setActivity(Array.isArray(payload.activity) ? payload.activity : []);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[natori-project-activity] timeline load failed", error);
        setFailed(true);
        setActivity([]);
      });

    return () => controller.abort();
  }, [projectId]);

  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
        対応履歴
      </h3>

      {activity === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-pink-50/60" />
      ) : activity.length > 0 ? (
        <ol className="space-y-1.5">
          {activity.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2 text-xs"
            >
              <p className="font-bold text-gray-900">
                {formatDateTime(item.occurredAt)}｜{getNatoriProjectActivityLabel(item.eventType)}
              </p>
              <p className="mt-0.5 text-gray-500">
                {item.sourceType} / {item.sourceId}
              </p>
            </li>
          ))}
        </ol>
      ) : legacyLogs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">
            新しい履歴台帳にはまだ記録がないため、過去のメモ内履歴を表示しています。
          </p>
          <ol className="space-y-1.5">
            {legacyLogs.map((log, index) => (
              <li
                key={`${log.dateISO}-${index}`}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
              >
                <p className="font-bold text-gray-900">
                  {formatLegacyDate(log.dateISO)}｜{log.label}
                </p>
                {log.body ? (
                  <p className="mt-0.5 whitespace-pre-wrap break-all text-gray-600">
                    {log.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
          {failed
            ? "履歴を読み込めませんでした。画面を開き直してください。"
            : "まだ対応履歴がありません（受付のみ）。"}
        </p>
      )}
    </section>
  );
}
