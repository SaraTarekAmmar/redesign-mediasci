
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  getYear,
  getMonth,
  setMonth,
  setYear,
  isAfter,
  isBefore,
} from "date-fns";
import { cn } from "../../lib/utils";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useExclusiveOverlay } from "./openOverlay";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({ value, onChange, placeholder, disabled, className, id }: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const parsedDate = value ? new Date(value + "T00:00:00") : null;
  const [viewDate, setViewDate] = useState<Date>(parsedDate ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef as React.RefObject<HTMLElement>, () => setOpen(false));
  useExclusiveOverlay(open, () => setOpen(false));

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (parsedDate) setViewDate(parsedDate);
  }, [value]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const currentYear = getYear(viewDate);
  const currentMonth = getMonth(viewDate);

  const selectDay = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const changeMonth = (dir: number) => {
    setViewDate((d) => addMonths(d, dir));
  };

  const changeYear = (dir: number) => {
    setViewDate((d) => addYears(d, dir));
  };

  return (
    <div ref={containerRef} className={cn("relative", className)} id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">{value ? format(parsedDate!, "MMM d, yyyy") : (placeholder ?? t("app.pickDate"))}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[280px] rounded-xl border border-border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-top-2">
          {/* Header: Month/Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-md p-1 hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              <select
                value={currentMonth}
                onChange={(e) => setViewDate((d) => setMonth(d, Number(e.target.value)))}
                className="rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {MONTHS_SHORT.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={currentYear}
                onChange={(e) => setViewDate((d) => setYear(d, Number(e.target.value)))}
                className="rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {Array.from({ length: 21 }, (_, i) => currentYear - 10 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-md p-1 hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewDate);
              const selected = value && isSameDay(day, parsedDate!);
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                    !inMonth && "text-muted-foreground/40",
                    inMonth && !selected && "text-foreground hover:bg-accent",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    today && !selected && "ring-1 ring-primary/50"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function addYears(date: Date, years: number): Date {
  return setYear(date, getYear(date) + years);
}
