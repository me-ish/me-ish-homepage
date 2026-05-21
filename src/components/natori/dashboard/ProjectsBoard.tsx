"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Heart, Inbox, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockNatoriProjects } from "@/lib/natori/mockProjects";
import type { NatoriProject, NatoriProjectFilter } from "@/types/natori/projects";
import ProjectCard from "./ProjectCard";

const filters: Array<{ id: NatoriProjectFilter; label: string }> = [
  { id: "all", label: "全件" },
  { id: "active", label: "進行中" },
  { id: "waiting", label: "確認待ち" },
  { id: "done", label: "完了" },
];

function matchesFilter(project: NatoriProject, filter: NatoriProjectFilter) {
  if (filter === "all") return true;
  if (filter === "waiting") return project.status === "waiting";
  if (filter === "done") return project.status === "delivered";
  return project.status !== "waiting" && project.status !== "delivered";
}

function getFocusProjects(projects: NatoriProject[]) {
  return projects
    .filter((project) => project.status !== "delivered")
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
}

export default function ProjectsBoard() {
  const [filter, setFilter] = useState<NatoriProjectFilter>("active");

  const visibleProjects = useMemo(
    () => mockNatoriProjects.filter((project) => matchesFilter(project, filter)),
    [filter]
  );

  const focusProjects = useMemo(() => getFocusProjects(mockNatoriProjects), []);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
            <Heart className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-pink-700">今日見るところ</p>
            <h2 className="mt-1 text-xl font-black leading-7 text-pink-950 sm:text-2xl">次に進める案件</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              納期が近い順に、制作前に確認したい「次やること」だけを並べています。
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {focusProjects.map((project) => (
            <div key={project.id} className="min-w-0 rounded-2xl bg-pink-50/70 p-3">
              <p className="break-words text-sm font-bold text-pink-950">{project.title}</p>
              <p className="mt-1 break-words text-base font-black text-pink-700">{project.nextAction}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-pink-700">
              <ListFilter className="h-4 w-4" aria-hidden />
              案件一覧
            </div>
            <p className="mt-1 text-sm leading-6 text-gray-600">状態で軽く絞り込めます。編集や保存はまだ行いません。</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:justify-end">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  onClick={() => setFilter(item.id)}
                  className={
                    active
                      ? "h-11 rounded-full bg-pink-600 px-4 text-sm font-bold text-white hover:bg-pink-700 sm:h-10"
                      : "h-11 rounded-full border-pink-200 bg-white px-4 text-sm font-bold text-pink-700 hover:bg-pink-50 sm:h-10"
                  }
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {filter === "done" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
          ) : filter === "waiting" ? (
            <Inbox className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
          ) : (
            <Clock3 className="h-4 w-4 shrink-0 text-pink-500" aria-hidden />
          )}
          <span className="font-bold text-gray-900">{visibleProjects.length}件</span>
          <span>表示中</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}
