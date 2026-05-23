"use client";

import { useEffect, useMemo, useState } from "react";
import { mockNatoriProjects } from "@/lib/natori/mockProjects";
import {
  deriveNextActionFromTasks,
  deriveStatusFromTasks,
  getProjectsForDate,
  getPrioritySuggestions,
  toISODate,
} from "@/lib/natori/projects";
import {
  getAwaitingPaymentSummary,
  getScheduleEntries,
  getWeeklyForecast,
  type NatoriScheduleEntry,
} from "@/lib/natori/scheduling";
import type { NatoriPriorityCandidate, NatoriProject } from "@/types/natori/projects";
import ProjectMonthCalendar from "./ProjectMonthCalendar";
import ProjectDayDetail from "./ProjectDayDetail";
import ProjectPriorityList from "./ProjectPriorityList";
import ScheduleSummary from "./ScheduleSummary";
import AwaitingPaymentSummary from "./AwaitingPaymentSummary";

type ViewMonth = { year: number; monthIndex: number };

function getMonthFromDate(date: Date): ViewMonth {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export default function ProjectsBoard() {
  const [today, setToday] = useState<Date | null>(null);
  const [projects, setProjects] = useState<NatoriProject[]>(mockNatoriProjects);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<ViewMonth | null>(null);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setSelectedISO(toISODate(now));
    setViewMonth(getMonthFromDate(now));
  }, []);

  const suggestions = useMemo<NatoriPriorityCandidate[]>(
    () => (today ? getPrioritySuggestions(projects, today, 3) : []),
    [projects, today]
  );

  const dayProjects = useMemo(
    () => (selectedISO ? getProjectsForDate(projects, selectedISO) : []),
    [projects, selectedISO]
  );

  const scheduleEntries = useMemo(
    () => (today ? getScheduleEntries(projects, today) : []),
    [projects, today]
  );

  const forecast = useMemo(() => getWeeklyForecast(scheduleEntries), [scheduleEntries]);

  const awaitingPaymentSummary = useMemo(
    () => getAwaitingPaymentSummary(projects),
    [projects]
  );

  if (!today || !selectedISO || !viewMonth) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-72 animate-pulse rounded-2xl bg-pink-50/60" />
      </div>
    );
  }

  const handleSelectDate = (iso: string) => {
    setSelectedISO(iso);
  };

  const handlePrevMonth = () => {
    setViewMonth((current) => {
      if (!current) return current;
      const next = new Date(current.year, current.monthIndex - 1, 1);
      return getMonthFromDate(next);
    });
  };

  const handleNextMonth = () => {
    setViewMonth((current) => {
      if (!current) return current;
      const next = new Date(current.year, current.monthIndex + 1, 1);
      return getMonthFromDate(next);
    });
  };

  const focusProject = (project: NatoriProject) => {
    const due = project.dueDate;
    setSelectedISO(due);
    const [y, m] = due.split("-").map(Number);
    setViewMonth({ year: y, monthIndex: m - 1 });
  };

  const handleSelectFromPriority = (candidate: NatoriPriorityCandidate) => {
    focusProject(candidate.project);
  };

  const handleSelectFromSchedule = (entry: NatoriScheduleEntry) => {
    focusProject(entry.project);
  };

  const handleToggleTask = (projectId: string, taskId: string) => {
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const nextTasks = project.tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task
        );
        const nextStatus = deriveStatusFromTasks(nextTasks, project.status);
        const nextAction = deriveNextActionFromTasks(nextTasks, project.nextAction);
        return {
          ...project,
          tasks: nextTasks,
          status: nextStatus,
          nextAction,
        };
      })
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <ScheduleSummary
        entries={scheduleEntries}
        forecast={forecast}
        onSelect={handleSelectFromSchedule}
      />

      <AwaitingPaymentSummary
        summary={awaitingPaymentSummary}
        today={today}
        onSelect={focusProject}
      />

      <ProjectPriorityList
        suggestions={suggestions}
        today={today}
        onSelect={handleSelectFromPriority}
      />

      <ProjectMonthCalendar
        year={viewMonth.year}
        monthIndex={viewMonth.monthIndex}
        projects={projects}
        today={today}
        selectedISO={selectedISO}
        onSelect={handleSelectDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <ProjectDayDetail
        selectedISO={selectedISO}
        allProjects={projects}
        projects={dayProjects}
        today={today}
        onToggleTask={handleToggleTask}
      />
    </div>
  );
}
