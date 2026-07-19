"use client";

// features/etorie/components/demoapp/DemoBoards.tsx
// デモ環境用の薄いラッパー群。サンプルデータを生成して natori の実ボードに
// そのまま渡す（ボード側は demo prop でサーバーアクセスを行わない）。
import { useMemo, useState } from "react";
import InquiriesBoard from "@/features/natori/components/dashboard/InquiriesBoard";
import ProjectsBoard from "@/features/natori/components/dashboard/ProjectsBoard";
import ResultsBoard from "@/features/natori/components/dashboard/ResultsBoard";
import {
  makeDemoEvents,
  makeDemoWorkspaceProjects,
} from "@/features/etorie/lib/demoWorkspace";

function useDemoWorkspace() {
  const [today] = useState(() => new Date());
  const projects = useMemo(() => makeDemoWorkspaceProjects(today), [today]);
  const events = useMemo(() => makeDemoEvents(today), [today]);
  return { projects, events };
}

export function DemoInquiries() {
  const { projects } = useDemoWorkspace();
  return <InquiriesBoard demoProjects={projects} />;
}

export function DemoProjects() {
  const { projects, events } = useDemoWorkspace();
  return <ProjectsBoard demoProjects={projects} demoEvents={events} />;
}

export function DemoResults() {
  const { projects } = useDemoWorkspace();
  return <ResultsBoard demoProjects={projects} />;
}
