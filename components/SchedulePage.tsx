"use client";

import {
  AlertTriangle,
  Activity,
  CalendarDays,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  Loader2,
  Lock,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Sunrise,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "viewer" | "admin";
type ViewMode = "month" | "year" | "range";
type Audience = "boys" | "girls" | "mixed";
type TrainingStatus = "scheduled" | "running" | "completed" | "postponed";
type OperationalStatus = "ongoing" | "upcoming" | "completed" | "postponed" | "past";
type Priority = "low" | "normal" | "high";

type TrainingSession = {
  id: number;
  sessionName: "morning" | "afternoon" | "night";
  startTime: string;
  endTime: string;
};

type Todo = {
  id: number;
  label: string;
  done: boolean;
  sortOrder: number;
};

type Training = {
  id: number;
  college_name: string;
  audience: Audience;
  program_name: string;
  faculty_name: string;
  coordinator_name: string;
  coordinator_phone: string;
  venue: string;
  faculty_count: number;
  participant_count: number;
  priority: Priority;
  start_session_label: string;
  start_session_start: string;
  start_session_end: string;
  end_session_label: string;
  end_session_start: string;
  end_session_end: string;
  start_date: string;
  end_date: string;
  status: TrainingStatus;
  notes: string;
  sessions: TrainingSession[];
  todos: Todo[];
};

type UnavailableDate = {
  id: number;
  unavailable_date: string;
  reason: string;
};

type Overview = {
  trainings: Training[];
  unavailableDates: UnavailableDate[];
};

const emptyOverview: Overview = {
  trainings: [],
  unavailableDates: []
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const sessionDefaults = [
  { name: "morning", label: "Morning", startTime: "09:30", endTime: "12:30", icon: Sunrise },
  { name: "afternoon", label: "Afternoon", startTime: "13:30", endTime: "16:30", icon: Sun },
  { name: "night", label: "Night", startTime: "18:00", endTime: "20:30", icon: Moon }
] as const;

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parseIso(value));
}

function daysBetween(start: string, end: string) {
  const days: string[] = [];
  let cursor = parseIso(start);
  const last = parseIso(end);
  while (cursor <= last) {
    days.push(toIso(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function isWithin(iso: string, training: Training) {
  return iso >= training.start_date.slice(0, 10) && iso <= training.end_date.slice(0, 10);
}

function operationalStatus(training: Training, today = toIso(new Date())): OperationalStatus {
  if (training.status === "completed") return "completed";
  if (training.status === "postponed") return "postponed";
  if (today >= training.start_date && today <= training.end_date) return "ongoing";
  if (today < training.start_date) return "upcoming";
  return "past";
}

function statusLabel(status: OperationalStatus) {
  const labels: Record<OperationalStatus, string> = {
    ongoing: "Ongoing",
    upcoming: "Upcoming",
    completed: "Completed",
    postponed: "Rescheduled",
    past: "Past due"
  };
  return labels[status];
}

function durationLabel(training: Training) {
  return `${daysBetween(training.start_date, training.end_date).length} days`;
}

function sessionBadge(date: string, training: Training) {
  if (date === training.start_date && date === training.end_date) {
    return `${training.start_session_start}-${training.end_session_end}`;
  }
  if (date === training.start_date) {
    return `Start ${training.start_session_start}`;
  }
  if (date === training.end_date) {
    return `End ${training.end_session_end}`;
  }
  return "Full day";
}

function middleDaysCount(training: Training) {
  return Math.max(daysBetween(training.start_date, training.end_date).length - 2, 0);
}

function calendarMonthDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const first = addDays(start, -start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

function getViewDates(mode: ViewMode, cursor: Date, rangeStart: string, rangeEnd: string) {
  if (mode === "year") {
    const start = toIso(new Date(cursor.getFullYear(), 0, 1));
    const end = toIso(new Date(cursor.getFullYear(), 11, 31));
    return daysBetween(start, end);
  }

  if (mode === "range" && rangeStart <= rangeEnd) {
    return daysBetween(rangeStart, rangeEnd);
  }

  const start = toIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const end = toIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
  return daysBetween(start, end);
}

const storageKey = "slotviewer-schedule-state-v3";

function formText(form: FormData, key: string, fallback = "") {
  return String(form.get(key) ?? fallback).trim();
}

function formNumber(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeAudience(value: FormDataEntryValue | null): Audience {
  return value === "girls" || value === "mixed" ? value : "boys";
}

function normalizePriority(value: FormDataEntryValue | null): Priority {
  return value === "high" || value === "low" ? value : "normal";
}

function createTodos(value: string, baseId = Date.now()) {
  return value
    .split("\n")
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: baseId + index + 1,
      label,
      done: false,
      sortOrder: index + 1
    }));
}

function sortOverview(overview: Overview): Overview {
  return {
    trainings: [...overview.trainings].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    unavailableDates: [...overview.unavailableDates].sort((a, b) =>
      a.unavailable_date.localeCompare(b.unavailable_date)
    )
  };
}

function rangeHasBlockedDate(startDate: string, endDate: string, unavailableDates: UnavailableDate[]) {
  const range = new Set(daysBetween(startDate, endDate));
  return unavailableDates.find((date) => range.has(date.unavailable_date));
}

function rangeHasTrainingConflict(
  startDate: string,
  endDate: string,
  trainings: Training[],
  excludeId?: number
) {
  const range = new Set(daysBetween(startDate, endDate));
  return trainings.find(
    (training) =>
      training.id !== excludeId &&
      training.status !== "completed" &&
      daysBetween(training.start_date, training.end_date).some((date) => range.has(date))
  );
}

function createSeedOverview(): Overview {
  const today = new Date();
  return {
    trainings: [
      {
        id: 101,
        college_name: "St. Marys College",
        audience: "girls",
        program_name: "Python Skill Training",
        faculty_name: "Anika Rao",
        coordinator_name: "Divya S",
        coordinator_phone: "9876543210",
        venue: "Computer Lab A",
        faculty_count: 2,
        participant_count: 48,
        priority: "high",
        start_session_label: "morning",
        start_session_start: "09:30",
        start_session_end: "12:30",
        end_session_label: "afternoon",
        end_session_start: "13:30",
        end_session_end: "16:30",
        start_date: toIso(addDays(today, -1)),
        end_date: toIso(addDays(today, 4)),
        status: "scheduled",
        notes: "Lab access confirmed. Attendance sheet pending.",
        sessions: [],
        todos: createTodos("Verify lab systems\nCollect attendance\nUpload daily report", 1010)
      },
      {
        id: 102,
        college_name: "Kongu Arts College",
        audience: "boys",
        program_name: "Cloud Fundamentals",
        faculty_name: "R. Nirmal",
        coordinator_name: "Karthik P",
        coordinator_phone: "9000012345",
        venue: "Seminar Hall",
        faculty_count: 3,
        participant_count: 64,
        priority: "normal",
        start_session_label: "afternoon",
        start_session_start: "13:30",
        start_session_end: "16:30",
        end_session_label: "morning",
        end_session_start: "09:30",
        end_session_end: "12:30",
        start_date: toIso(addDays(today, 8)),
        end_date: toIso(addDays(today, 13)),
        status: "scheduled",
        notes: "Confirm projector and internet availability.",
        sessions: [],
        todos: createTodos("Send joining instructions\nCheck trainer travel\nPrepare feedback QR", 1020)
      },
      {
        id: 103,
        college_name: "Vetri Engineering College",
        audience: "mixed",
        program_name: "AI Productivity Workshop",
        faculty_name: "Meera Joseph",
        coordinator_name: "Harini R",
        coordinator_phone: "9444411111",
        venue: "Innovation Lab",
        faculty_count: 2,
        participant_count: 52,
        priority: "low",
        start_session_label: "morning",
        start_session_start: "10:00",
        start_session_end: "12:30",
        end_session_label: "afternoon",
        end_session_start: "14:00",
        end_session_end: "16:00",
        start_date: toIso(addDays(today, -12)),
        end_date: toIso(addDays(today, -7)),
        status: "completed",
        notes: "Completion marked and report submitted.",
        sessions: [],
        todos: createTodos("Collect attendance\nSubmit completion report", 1030).map((todo) => ({
          ...todo,
          done: true
        }))
      }
    ],
    unavailableDates: [
      {
        id: 201,
        unavailable_date: toIso(addDays(today, 6)),
        reason: "Campus maintenance"
      },
      {
        id: 202,
        unavailable_date: toIso(addDays(today, 17)),
        reason: "Festival holiday"
      }
    ]
  };
}

function readOverviewFromStorage() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const seeded = sortOverview(createSeedOverview());
      window.localStorage.setItem(storageKey, JSON.stringify(seeded));
      return seeded;
    }
    return sortOverview(JSON.parse(raw) as Overview);
  } catch {
    return sortOverview(createSeedOverview());
  }
}

function writeOverviewToStorage(overview: Overview) {
  window.localStorage.setItem(storageKey, JSON.stringify(overview));
}

export function SchedulePage({ lockedRole }: { lockedRole: Role }) {
  const role = lockedRole;
  const [mode, setMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState(toIso(new Date()));
  const [rangeEnd, setRangeEnd] = useState(toIso(addDays(new Date(), 30)));
  const [selectedDate, setSelectedDate] = useState(toIso(new Date()));
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function saveOverview(nextOverview: Overview) {
    const sorted = sortOverview(nextOverview);
    setOverview(sorted);
    writeOverviewToStorage(sorted);
  }

  function load() {
    setLoading(true);
    setError("");
    try {
      setOverview(readOverviewFromStorage());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load schedule");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unavailableMap = useMemo(() => {
    return new Map(
      overview.unavailableDates.map((date) => [
        date.unavailable_date.slice(0, 10),
        date.reason
      ])
    );
  }, [overview.unavailableDates]);

  const selectedTrainings = overview.trainings.filter((training) =>
    isWithin(selectedDate, training)
  );

  const activeTraining = overview.trainings.find(
    (training) => operationalStatus(training) === "ongoing"
  );
  const analytics = useMemo(() => {
    const viewDates = getViewDates(mode, cursor, rangeStart, rangeEnd);
    const viewDateSet = new Set(viewDates);
    const visibleTrainings = overview.trainings.filter((training) =>
      daysBetween(training.start_date, training.end_date).some((day) => viewDateSet.has(day))
    );
    const scheduledDays = new Set(
      visibleTrainings.flatMap((training) =>
        daysBetween(training.start_date, training.end_date).filter((day) => viewDateSet.has(day))
      )
    );
    const blocked = overview.unavailableDates.filter((date) =>
      viewDateSet.has(date.unavailable_date)
    ).length;
    const statuses = visibleTrainings.map((training) => operationalStatus(training));
    return {
      total: visibleTrainings.length,
      openDates: viewDates.filter((day) => !scheduledDays.has(day) && !unavailableMap.has(day)).length,
      ongoing: statuses.filter((status) => status === "ongoing").length,
      upcoming: statuses.filter((status) => status === "upcoming").length,
      completed: statuses.filter((status) => status === "completed").length,
      highPriority: visibleTrainings.filter((training) => training.priority === "high").length,
      blocked
    };
  }, [cursor, mode, overview.trainings, overview.unavailableDates, rangeEnd, rangeStart, unavailableMap]);
  const priorityQueue = useMemo(() => {
    const statusRank: Record<OperationalStatus, number> = {
      ongoing: 0,
      upcoming: 1,
      postponed: 2,
      past: 3,
      completed: 4
    };
    const priorityRank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
    return [...overview.trainings]
      .sort((a, b) => {
        const statusDelta = statusRank[operationalStatus(a)] - statusRank[operationalStatus(b)];
        if (statusDelta) return statusDelta;
        const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDelta) return priorityDelta;
        return a.start_date.localeCompare(b.start_date);
      })
      .slice(0, 5);
  }, [overview.trainings]);

  function createTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    const startDate = formText(form, "startDate");
    const endDate = formText(form, "endDate");
    const id = Date.now();

    if (!startDate || !endDate || endDate < startDate) {
      setError("Choose a valid start and end date.");
      setSaving(false);
      return;
    }

    const blockedDate = rangeHasBlockedDate(startDate, endDate, overview.unavailableDates);
    if (blockedDate) {
      setError(`Cannot schedule on ${formatDate(blockedDate.unavailable_date)} because it is blocked.`);
      setSaving(false);
      return;
    }

    const conflict = rangeHasTrainingConflict(startDate, endDate, overview.trainings);
    if (conflict) {
      setError(`Slot already booked by ${conflict.college_name} from ${formatDate(conflict.start_date)}.`);
      setSaving(false);
      return;
    }

    const nextTraining: Training = {
      id,
      college_name: formText(form, "collegeName"),
      audience: normalizeAudience(form.get("audience")),
      program_name: formText(form, "programName"),
      faculty_name: formText(form, "facultyName"),
      coordinator_name: formText(form, "coordinatorName"),
      coordinator_phone: formText(form, "coordinatorPhone"),
      venue: formText(form, "venue"),
      faculty_count: Math.max(formNumber(form, "facultyCount", 1), 1),
      participant_count: formNumber(form, "participantCount", 0),
      priority: normalizePriority(form.get("priority")),
      start_session_label: formText(form, "startSessionLabel", "morning"),
      start_session_start: formText(form, "startSessionStart", "09:30"),
      start_session_end: formText(form, "startSessionEnd", "12:30"),
      end_session_label: formText(form, "endSessionLabel", "afternoon"),
      end_session_start: formText(form, "endSessionStart", "13:30"),
      end_session_end: formText(form, "endSessionEnd", "16:30"),
      start_date: startDate,
      end_date: endDate,
      status: "scheduled",
      notes: formText(form, "notes"),
      sessions: [],
      todos: createTodos(formText(form, "todos"), id)
    };

    saveOverview({
      ...overview,
      trainings: [...overview.trainings, nextTraining]
    });
    target.reset();
    setSaving(false);
  }

  function blockDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    const date = formText(form, "date");
    const reason = formText(form, "reason");

    if (!date || !reason) {
      setError("Choose a date and reason before blocking the slot.");
      setSaving(false);
      return;
    }

    const existingTraining = overview.trainings.find(
      (training) => training.status !== "completed" && isWithin(date, training)
    );
    if (existingTraining) {
      setError(`That date is already booked by ${existingTraining.college_name}.`);
      setSaving(false);
      return;
    }

    if (overview.unavailableDates.some((item) => item.unavailable_date === date)) {
      setError("That date is already marked unavailable.");
      setSaving(false);
      return;
    }

    saveOverview({
      ...overview,
      unavailableDates: [
        ...overview.unavailableDates,
        {
          id: Date.now(),
          unavailable_date: date,
          reason
        }
      ]
    });
    target.reset();
    setSaving(false);
  }

  function updateTraining(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const id = Number(payload.id);
    const action = String(payload.action ?? "");

    if (!id) {
      setError("Unable to find the selected training.");
      setSaving(false);
      return;
    }

    if (action === "reschedule") {
      const startDate = String(payload.startDate ?? "");
      const endDate = String(payload.endDate ?? "");
      if (!startDate || !endDate || endDate < startDate) {
        setError("Choose a valid prepone/postpone date range.");
        setSaving(false);
        return;
      }
      const blockedDate = rangeHasBlockedDate(startDate, endDate, overview.unavailableDates);
      if (blockedDate) {
        setError(`Cannot move to ${formatDate(blockedDate.unavailable_date)} because it is blocked.`);
        setSaving(false);
        return;
      }
      const conflict = rangeHasTrainingConflict(startDate, endDate, overview.trainings, id);
      if (conflict) {
        setError(`That slot overlaps with ${conflict.college_name}.`);
        setSaving(false);
        return;
      }
    }

    saveOverview({
      ...overview,
      trainings: overview.trainings.map((training) => {
        if (training.id !== id) return training;

        if (action === "complete") {
          return { ...training, status: "completed" };
        }

        if (action === "toggleTodo") {
          const todoId = Number(payload.todoId);
          return {
            ...training,
            todos: training.todos.map((todo) =>
              todo.id === todoId ? { ...todo, done: !todo.done } : todo
            )
          };
        }

        if (action === "reschedule") {
          return {
            ...training,
            start_date: String(payload.startDate),
            end_date: String(payload.endDate),
            status: "postponed"
          };
        }

        if (action === "edit") {
          return {
            ...training,
            college_name: String(payload.collegeName ?? training.college_name),
            program_name: String(payload.programName ?? training.program_name),
            faculty_name: String(payload.facultyName ?? training.faculty_name),
            coordinator_name: String(payload.coordinatorName ?? training.coordinator_name),
            coordinator_phone: String(payload.coordinatorPhone ?? training.coordinator_phone),
            venue: String(payload.venue ?? training.venue),
            faculty_count: Math.max(Number(payload.facultyCount) || training.faculty_count, 1),
            participant_count: Number(payload.participantCount) || training.participant_count,
            priority: normalizePriority(payload.priority as FormDataEntryValue | null),
            start_session_label: String(payload.startSessionLabel ?? training.start_session_label),
            start_session_start: String(payload.startSessionStart ?? training.start_session_start),
            start_session_end: String(payload.startSessionEnd ?? training.start_session_end),
            end_session_label: String(payload.endSessionLabel ?? training.end_session_label),
            end_session_start: String(payload.endSessionStart ?? training.end_session_start),
            end_session_end: String(payload.endSessionEnd ?? training.end_session_end),
            audience: normalizeAudience(payload.audience as FormDataEntryValue | null),
            notes: String(payload.notes ?? training.notes)
          };
        }

        return training;
      })
    });
    setSaving(false);
  }

  return (
    <main className="site">
      <header className="appHeader">
        <div className="identity">
          <div className="brandMark">
            <CalendarDays size={24} />
          </div>
          <div>
            <span>Skill Training Calendar</span>
            <strong>Slot Schedule Visualizer</strong>
          </div>
        </div>

        <div className="headerActions">
          {role === "admin" ? (
            <Link className="routeButton ghost" href="/">
              <Eye size={16} />
              Viewer site
            </Link>
          ) : (
            <Link className="routeButton" href="/admin/login">
              <ShieldCheck size={16} />
              Admin login
            </Link>
          )}
        </div>
      </header>

      <section className="overviewBand">
        <div>
          <p className="eyebrow">{role === "admin" ? "Admin console" : "Schedule viewer"}</p>
          <h1>Training slot calendar</h1>
          <p className="overviewCopy">
            Metrics update for the selected Month, Year, or Date Range.
          </p>
        </div>
        <div className="analyticsGrid">
          <AnalyticsChip tone="blue" label="Total schedules" value={analytics.total} />
          <AnalyticsChip tone="amber" label="Ongoing" value={analytics.ongoing} />
          <AnalyticsChip tone="navy" label="Upcoming" value={analytics.upcoming} />
          <AnalyticsChip tone="green" label="Completed" value={analytics.completed} />
          <AnalyticsChip tone="green" label="Open dates" value={analytics.openDates} />
          <AnalyticsChip tone="red" label="Blocked dates" value={analytics.blocked} />
          <AnalyticsChip tone="rose" label="High priority" value={analytics.highPriority} />
        </div>
      </section>

      <section className="legendBar" aria-label="Calendar legend">
        <span><i className="legendFree" /> Available</span>
        <span><i className="legendUpcoming" /> Upcoming</span>
        <span><i className="legendRunning" /> Ongoing</span>
        <span><i className="legendCompleted" /> Completed</span>
        <span><i className="legendBlocked" /> Blocked</span>
      </section>

      {error ? <div className="alert">{error}</div> : null}
      {loading ? (
        <div className="loading">
          <Loader2 className="spin" size={18} />
          Loading schedule
        </div>
      ) : null}

      {!loading ? (
        <section className="mainGrid">
          <div className="calendarColumn">
            <div className="toolbar">
              <div className="segmented">
                {(["month", "year", "range"] as ViewMode[]).map((item) => (
                  <button
                    className={mode === item ? "active" : ""}
                    key={item}
                    onClick={() => setMode(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="monthControls">
                <button
                  aria-label="Previous"
                  type="button"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <strong>
                  {mode === "year"
                    ? cursor.getFullYear()
                    : `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`}
                </strong>
                <button
                  aria-label="Next"
                  type="button"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {mode === "range" ? (
              <div className="rangeControls">
                <label>
                  From
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {mode === "month" ? (
              <MonthCalendar
                cursor={cursor}
                selectedDate={selectedDate}
                trainings={overview.trainings}
                unavailableMap={unavailableMap}
                onSelect={setSelectedDate}
              />
            ) : null}

            {mode === "year" ? (
              <YearCalendar
                cursor={cursor}
                selectedDate={selectedDate}
                trainings={overview.trainings}
                unavailableMap={unavailableMap}
                onSelect={setSelectedDate}
              />
            ) : null}

            {mode === "range" ? (
              <RangeCalendar
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                selectedDate={selectedDate}
                trainings={overview.trainings}
                unavailableMap={unavailableMap}
                onSelect={setSelectedDate}
              />
            ) : null}
          </div>

          <aside className="sidePanel">
            <SelectedDay
              date={selectedDate}
              trainings={selectedTrainings}
              unavailableReason={unavailableMap.get(selectedDate)}
              role={role}
              saving={saving}
              onUpdate={updateTraining}
            />

            <ScheduleQueue trainings={priorityQueue} />

            {activeTraining ? (
              <section className="panel runningPanel">
                <div className="panelHead">
                  <h2>Currently running</h2>
                  <span className="status running">Running</span>
                </div>
                <strong>{activeTraining.college_name}</strong>
                <p>{activeTraining.program_name} with {activeTraining.faculty_name}</p>
                <TodoList
                  todos={activeTraining.todos}
                  onToggle={
                    role === "admin"
                      ? (todoId) =>
                          updateTraining({
                            id: activeTraining.id,
                            action: "toggleTodo",
                            todoId
                          })
                      : undefined
                  }
                />
              </section>
            ) : null}
          </aside>
        </section>
      ) : null}

      {!loading && role === "admin" ? (
        <section className="adminGrid">
          <CreateTrainingForm saving={saving} onSubmit={createTraining} />
          <BlockDateForm
            unavailableDates={overview.unavailableDates}
            saving={saving}
            onSubmit={blockDate}
          />
        </section>
      ) : null}
    </main>
  );
}

function MonthCalendar({
  cursor,
  selectedDate,
  trainings,
  unavailableMap,
  onSelect
}: {
  cursor: Date;
  selectedDate: string;
  trainings: Training[];
  unavailableMap: Map<string, string>;
  onSelect: (date: string) => void;
}) {
  const weeks = Array.from({ length: 6 }, (_, week) =>
    calendarMonthDays(cursor).slice(week * 7, week * 7 + 7)
  );
  const ranges = buildTrainingSegments(trainings, cursor);

  return (
    <section className="monthCalendar">
      <div className="weekHeader">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="monthRows">
        {weeks.map((week, weekIndex) => (
          <div className="monthWeek" key={week.map(toIso).join("-")}>
            <div className="monthGrid">
              {week.map((day) => {
                const iso = toIso(day);
                return (
                  <DayCell
                    date={iso}
                    isMuted={day.getMonth() !== cursor.getMonth()}
                    isSelected={selectedDate === iso}
                    key={iso}
                    trainings={trainings.filter((training) => isWithin(iso, training))}
                    unavailableReason={unavailableMap.get(iso)}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
            <div className="rangeLayer" aria-hidden="true">
              {ranges
                .filter((segment) => segment.weekIndex === weekIndex)
                .map((segment) => (
                  <div
                    className={`rangeBand ${segment.status} priority-${segment.training.priority}`}
                    key={`${segment.training.id}-${segment.weekIndex}-${segment.startColumn}`}
                    style={{
                      gridColumn: `${segment.startColumn} / span ${segment.span}`,
                      top: `${50 + segment.lane * 30}px`
                    }}
                  >
                    <span>{segment.training.college_name}</span>
                    <small>{segment.label}</small>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildTrainingSegments(trainings: Training[], cursor: Date) {
  const visibleWeeks = Array.from({ length: 6 }, (_, week) =>
    calendarMonthDays(cursor).slice(week * 7, week * 7 + 7).map(toIso)
  );

  return visibleWeeks.flatMap((week, weekIndex) => {
    const segments = trainings
      .map((training) => {
        const activeIndexes = week
          .map((date, index) => (isWithin(date, training) ? index : -1))
          .filter((index) => index >= 0);

        if (!activeIndexes.length) return null;

        const start = Math.min(...activeIndexes);
        const end = Math.max(...activeIndexes);
        return {
          training,
          weekIndex,
          startColumn: start + 1,
          endColumn: end + 1,
          span: end - start + 1,
          lane: 0,
          status: operationalStatus(training),
          label:
            week[start] === training.start_date
              ? `Start ${training.start_session_start}`
              : week[end] === training.end_date
                ? `End ${training.end_session_end}`
                : "Full day"
        };
      })
      .filter(Boolean) as Array<{
      training: Training;
      weekIndex: number;
      startColumn: number;
      endColumn: number;
      span: number;
      lane: number;
      status: OperationalStatus;
      label: string;
    }>;

    const lanes: number[] = [];
    return segments
      .sort((a, b) => a.startColumn - b.startColumn || b.span - a.span)
      .map((segment) => {
        const lane = lanes.findIndex((endColumn) => endColumn < segment.startColumn);
        const assignedLane = lane >= 0 ? lane : lanes.length;
        lanes[assignedLane] = segment.endColumn;
        return { ...segment, lane: assignedLane };
      });
  });
}

function YearCalendar({
  cursor,
  selectedDate,
  trainings,
  unavailableMap,
  onSelect
}: {
  cursor: Date;
  selectedDate: string;
  trainings: Training[];
  unavailableMap: Map<string, string>;
  onSelect: (date: string) => void;
}) {
  return (
    <section className="yearGrid">
      {monthNames.map((name, month) => {
        const monthDate = new Date(cursor.getFullYear(), month, 1);
        return (
          <article className="miniMonth" key={name}>
            <h3>{name}</h3>
            <div className="miniDays">
              {calendarMonthDays(monthDate).map((day) => {
                const iso = toIso(day);
                const dayTraining = trainings.find((training) => isWithin(iso, training));
                const blocked = unavailableMap.has(iso);
                return (
                  <button
                    className={[
                      "miniDay",
                      day.getMonth() !== month ? "muted" : "",
                      dayTraining ? operationalStatus(dayTraining) : "",
                      blocked ? "blocked" : "",
                      selectedDate === iso ? "selected" : ""
                    ].join(" ")}
                    key={iso}
                    onClick={() => onSelect(iso)}
                    type="button"
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function RangeCalendar({
  rangeStart,
  rangeEnd,
  selectedDate,
  trainings,
  unavailableMap,
  onSelect
}: {
  rangeStart: string;
  rangeEnd: string;
  selectedDate: string;
  trainings: Training[];
  unavailableMap: Map<string, string>;
  onSelect: (date: string) => void;
}) {
  const days = rangeStart <= rangeEnd ? daysBetween(rangeStart, rangeEnd) : [];
  return (
    <section className="rangeGrid">
      {days.map((date) => (
        <DayCell
          date={date}
          isMuted={false}
          isSelected={selectedDate === date}
          key={date}
          trainings={trainings.filter((training) => isWithin(date, training))}
          unavailableReason={unavailableMap.get(date)}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

function DayCell({
  date,
  isMuted,
  isSelected,
  trainings,
  unavailableReason,
  onSelect
}: {
  date: string;
  isMuted: boolean;
  isSelected: boolean;
  trainings: Training[];
  unavailableReason?: string;
  onSelect: (date: string) => void;
}) {
  const parsed = parseIso(date);
  const state = unavailableReason
    ? "blocked"
    : trainings.length
      ? operationalStatus(trainings[0])
      : "free";
  return (
    <button
      className={["dayCell", state, isMuted ? "muted" : "", isSelected ? "selected" : ""].join(" ")}
      onClick={() => onSelect(date)}
      type="button"
    >
      <div className="dayTop">
        <strong>{parsed.getDate()}</strong>
        <span>{state}</span>
      </div>
      {unavailableReason ? <p>{unavailableReason}</p> : null}
      {trainings.slice(0, 2).map((training) => (
        <div className={`eventPill ${operationalStatus(training)} priority-${training.priority}`} key={training.id}>
          <span>{training.college_name}</span>
          <small>{sessionBadge(date, training)}</small>
        </div>
      ))}
      {trainings.length > 2 ? <em>+{trainings.length - 2} more</em> : null}
    </button>
  );
}

function SelectedDay({
  date,
  trainings,
  unavailableReason,
  role,
  saving,
  onUpdate
}: {
  date: string;
  trainings: Training[];
  unavailableReason?: string;
  role: Role;
  saving: boolean;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  return (
    <section className="panel selectedPanel">
      <div className="panelHead">
        <div>
          <p className="eyebrow">Date details</p>
          <h2>{formatDate(date)}</h2>
        </div>
        {unavailableReason ? <span className="status blocked">Unavailable</span> : null}
      </div>

      {unavailableReason ? (
        <div className="blockedNote">
          <Lock size={16} />
          {unavailableReason}
        </div>
      ) : null}

      {!trainings.length && !unavailableReason ? (
        <div className="emptyState">
          <Search size={20} />
          <strong>Slot available</strong>
          <span>No training is scheduled for this date.</span>
        </div>
      ) : null}

      <div className="trainingStack">
        {trainings.map((training) => (
          <article className="trainingDetail" key={training.id}>
            <div className="detailTop">
              <div>
                <h3>{training.college_name}</h3>
                <p>{training.program_name}</p>
              </div>
              <span className={`status ${operationalStatus(training)}`}>
                {statusLabel(operationalStatus(training))}
              </span>
            </div>
            <div className="detailMeta">
              <span className={`priority priority-${training.priority}`}>
                {training.priority === "high" ? "High priority" : `${training.priority} priority`}
              </span>
              <span><Users size={13} /> {training.faculty_count || 1} faculty</span>
              <span><Users size={13} /> {training.participant_count || "Not set"} students</span>
              <span><MapPin size={13} /> {training.venue || "Venue not set"}</span>
              <span>{training.audience}</span>
              <span>{durationLabel(training)}</span>
            </div>
            <div className="detailMeta">
              <span>{training.faculty_name}</span>
              <span>{training.coordinator_phone || "No contact"}</span>
              <span>{formatDate(training.start_date)} - {formatDate(training.end_date)}</span>
            </div>
            <SessionPlan training={training} />
            {training.todos.length ? (
              <TodoList
                todos={training.todos}
                onToggle={
                  role === "admin"
                    ? (todoId) =>
                        onUpdate({
                          id: training.id,
                          action: "toggleTodo",
                          todoId
                        })
                    : undefined
                }
              />
            ) : null}

            {role === "admin" ? (
              <div className="adminActions">
                <button
                  disabled={saving || training.status === "completed"}
                  type="button"
                  onClick={() => onUpdate({ id: training.id, action: "complete" })}
                >
                  <CheckCircle2 size={16} />
                  Mark completed
                </button>
                <details className="editDrawer">
                  <summary>
                    <Edit3 size={16} />
                    Edit details
                  </summary>
                  <EditTrainingForm training={training} saving={saving} onUpdate={onUpdate} />
                </details>
                <RescheduleForm training={training} saving={saving} onUpdate={onUpdate} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ScheduleQueue({ trainings }: { trainings: Training[] }) {
  return (
    <section className="panel queuePanel">
      <div className="panelHead">
        <div>
          <p className="eyebrow">Priority queue</p>
          <h2>Schedules to watch</h2>
        </div>
        <AlertTriangle size={18} />
      </div>
      <div className="queueList">
        {trainings.map((training) => {
          const status = operationalStatus(training);
          return (
            <article className={`queueItem ${status}`} key={training.id}>
              <div>
                <strong>{training.college_name}</strong>
                <span>{formatDate(training.start_date)} - {durationLabel(training)}</span>
              </div>
              <div className="queueBadges">
                <span className={`status ${status}`}>{statusLabel(status)}</span>
                <span className={`priority priority-${training.priority}`}>
                  {training.priority}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EditTrainingForm({
  training,
  saving,
  onUpdate
}: {
  training: Training;
  saving: boolean;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdate({
      id: training.id,
      action: "edit",
      collegeName: form.get("collegeName"),
      programName: form.get("programName"),
      facultyName: form.get("facultyName"),
      coordinatorName: form.get("coordinatorName"),
      coordinatorPhone: form.get("coordinatorPhone"),
      venue: form.get("venue"),
      facultyCount: form.get("facultyCount"),
      participantCount: form.get("participantCount"),
      priority: form.get("priority"),
      startSessionLabel: form.get("startSessionLabel"),
      startSessionStart: form.get("startSessionStart"),
      startSessionEnd: form.get("startSessionEnd"),
      endSessionLabel: form.get("endSessionLabel"),
      endSessionStart: form.get("endSessionStart"),
      endSessionEnd: form.get("endSessionEnd"),
      audience: form.get("audience"),
      notes: form.get("notes")
    });
  }

  return (
    <form className="editForm" onSubmit={submit}>
      <label>
        College
        <input name="collegeName" defaultValue={training.college_name} />
      </label>
      <label>
        Training
        <input name="programName" defaultValue={training.program_name} />
      </label>
      <label>
        Faculty
        <input name="facultyName" defaultValue={training.faculty_name} />
      </label>
      <label>
        Students
        <select name="audience" defaultValue={training.audience}>
          <option value="boys">Boys</option>
          <option value="girls">Girls</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>
      <label>
        Priority
        <select name="priority" defaultValue={training.priority}>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Venue
        <input name="venue" defaultValue={training.venue} />
      </label>
      <label>
        Faculty count
        <input name="facultyCount" min="1" type="number" defaultValue={training.faculty_count} />
      </label>
      <label>
        Participants
        <input name="participantCount" min="0" type="number" defaultValue={training.participant_count} />
      </label>
      <label>
        Coordinator
        <input name="coordinatorName" defaultValue={training.coordinator_name} />
      </label>
      <label>
        Phone
        <input name="coordinatorPhone" defaultValue={training.coordinator_phone} />
      </label>
      <label>
        Start session
        <select name="startSessionLabel" defaultValue={training.start_session_label}>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="night">Night</option>
        </select>
      </label>
      <label>
        Start time
        <input name="startSessionStart" type="time" defaultValue={training.start_session_start} />
      </label>
      <label>
        Start end
        <input name="startSessionEnd" type="time" defaultValue={training.start_session_end} />
      </label>
      <label>
        End session
        <select name="endSessionLabel" defaultValue={training.end_session_label}>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="night">Night</option>
        </select>
      </label>
      <label>
        End start
        <input name="endSessionStart" type="time" defaultValue={training.end_session_start} />
      </label>
      <label>
        End time
        <input name="endSessionEnd" type="time" defaultValue={training.end_session_end} />
      </label>
      <label className="wide">
        Notes
        <textarea name="notes" rows={3} defaultValue={training.notes} />
      </label>
      <button disabled={saving} type="submit">
        Save changes
      </button>
    </form>
  );
}

function SessionPlan({ training }: { training: Training }) {
  return (
    <div className="sessionList sessionPlan">
      <span>
        <Sunrise size={14} />
        Start day: {training.start_session_label} {training.start_session_start}-{training.start_session_end}
      </span>
      <span>
        <Sun size={14} />
        Middle days: {middleDaysCount(training) ? `${middleDaysCount(training)} full-day booking` : "None"}
      </span>
      <span>
        <Moon size={14} />
        End day: {training.end_session_label} {training.end_session_start}-{training.end_session_end}
      </span>
    </div>
  );
}

function TodoList({
  todos,
  onToggle
}: {
  todos: Todo[];
  onToggle?: (todoId: number) => void;
}) {
  return (
    <div className="todoList">
      {todos
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((todo) =>
          onToggle ? (
            <button
              className={todo.done ? "done" : ""}
              key={todo.id}
              type="button"
              onClick={() => onToggle(todo.id)}
            >
              <CheckCircle2 size={14} />
              {todo.label}
            </button>
          ) : (
            <span className={todo.done ? "done" : ""} key={todo.id}>
              <CheckCircle2 size={14} />
              {todo.label}
            </span>
          )
        )}
    </div>
  );
}

function RescheduleForm({
  training,
  saving,
  onUpdate
}: {
  training: Training;
  saving: boolean;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdate({
      id: training.id,
      action: "reschedule",
      startDate: form.get("startDate"),
      endDate: form.get("endDate")
    });
  }

  return (
    <form className="rescheduleForm" onSubmit={submit}>
      <label>
        New start
        <input name="startDate" type="date" defaultValue={training.start_date.slice(0, 10)} />
      </label>
      <label>
        New end
        <input name="endDate" type="date" defaultValue={training.end_date.slice(0, 10)} />
      </label>
      <button disabled={saving} type="submit">
        <Clock3 size={16} />
        Prepone / postpone
      </button>
    </form>
  );
}

function CreateTrainingForm({
  saving,
  onSubmit
}: {
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel formPanel">
      <div className="panelHead">
        <div>
          <p className="eyebrow">Admin action</p>
          <h2>Schedule a training</h2>
        </div>
        <Plus size={20} />
      </div>
      <form onSubmit={onSubmit}>
        <div className="formSectionTitle">
          <span>1</span>
          Training details
        </div>
        <div className="formGrid">
          <label>
            College
            <input name="collegeName" required placeholder="College name" />
          </label>
          <label>
            Training
            <input name="programName" required placeholder="Skill training name" />
          </label>
          <label>
            Faculty
            <input name="facultyName" required placeholder="Faculty name" />
          </label>
          <label>
            Faculty count
            <input name="facultyCount" min="1" type="number" defaultValue="1" />
          </label>
          <label>
            Students
            <select name="audience" defaultValue="boys">
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <label>
            Participants
            <input name="participantCount" min="1" type="number" placeholder="Expected count" />
          </label>
          <label>
            Venue
            <input name="venue" placeholder="Lab, hall, or room" />
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="normal">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <div className="formSectionTitle">
          <span>2</span>
          Dates and contact
        </div>
        <div className="formGrid">
          <label>
            Start date
            <input name="startDate" required type="date" />
          </label>
          <label>
            End date
            <input name="endDate" required type="date" />
          </label>
          <label>
            Coordinator
            <input name="coordinatorName" placeholder="College coordinator" />
          </label>
          <label>
            Phone
            <input name="coordinatorPhone" placeholder="Contact number" />
          </label>
        </div>

        <div className="formSectionTitle">
          <span>3</span>
          Start and end sessions
        </div>
        <div className="sessionPicker two">
          <div className="sessionOption">
            <strong>Start date session</strong>
            <label>
              Session
              <select name="startSessionLabel" defaultValue="morning">
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="night">Night</option>
              </select>
            </label>
            <div className="timePair">
              <label>
                From
                <input name="startSessionStart" type="time" defaultValue="09:30" />
              </label>
              <label>
                To
                <input name="startSessionEnd" type="time" defaultValue="12:30" />
              </label>
            </div>
          </div>
          <div className="sessionOption">
            <strong>End date session</strong>
            <label>
              Session
              <select name="endSessionLabel" defaultValue="afternoon">
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="night">Night</option>
              </select>
            </label>
            <div className="timePair">
              <label>
                From
                <input name="endSessionStart" type="time" defaultValue="13:30" />
              </label>
              <label>
                To
                <input name="endSessionEnd" type="time" defaultValue="16:30" />
              </label>
            </div>
          </div>
        </div>
        <p className="formHint">Dates between start and end are automatically treated as full-day bookings.</p>

        <div className="formSectionTitle">
          <span>4</span>
          Readiness checklist
        </div>
        <label>
          Include todos
          <textarea
            name="todos"
            rows={5}
            placeholder={"One todo per line, for example:\nVerify lab systems\nCollect attendance\nUpload daily report"}
          />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} placeholder="Internal planning note" />
        </label>
        <button className="primary" disabled={saving} type="submit">
          {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Create schedule
        </button>
      </form>
    </section>
  );
}

function BlockDateForm({
  unavailableDates,
  saving,
  onSubmit
}: {
  unavailableDates: UnavailableDate[];
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel formPanel compact">
      <div className="panelHead">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Mark unavailable date</h2>
        </div>
        <Lock size={20} />
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Date
          <input name="date" required type="date" />
        </label>
        <label>
          Reason
          <input name="reason" required placeholder="Emergency leave, festival, maintenance" />
        </label>
        <button className="primary secondaryTone" disabled={saving} type="submit">
          Block date
        </button>
      </form>
      <div className="blockedList">
        {unavailableDates.map((date) => (
          <span key={date.id}>
            <strong>{formatDate(date.unavailable_date)}</strong>
            {date.reason}
          </span>
        ))}
      </div>
    </section>
  );
}

function AnalyticsChip({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red" | "rose" | "navy";
}) {
  const icons = {
    blue: CalendarDays,
    green: CalendarCheck2,
    amber: Activity,
    red: Lock,
    rose: AlertTriangle,
    navy: CalendarClock
  };
  const Icon = icons[tone];
  return (
    <div className={`analyticsChip ${tone}`}>
      <Icon size={18} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
