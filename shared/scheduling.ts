import type { CenterTimings, DayTiming } from "./schema";

export type ValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
};

export type TimeSlot = {
  open: string;
  close: string;
  breakStart?: string;
  breakEnd?: string;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function getDayName(date: Date): keyof CenterTimings {
  return DAY_NAMES[date.getDay()] as keyof CenterTimings;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function timeToDisplay(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function validateAppointmentTime(
  appointmentDate: Date,
  appointmentTime: string,
  centerTimings: CenterTimings | null | undefined
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  };

  if (!centerTimings) {
    result.warnings.push("Center operating hours not available - unable to validate time");
    return result;
  }

  const dayName = getDayName(appointmentDate);
  const dayTiming = centerTimings[dayName];

  if (!dayTiming) {
    result.warnings.push(`No timing data for ${dayName}`);
    return result;
  }

  if (dayTiming.closed) {
    result.valid = false;
    result.errors.push(`Center is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s`);
    return result;
  }

  if (!dayTiming.open || !dayTiming.close) {
    result.warnings.push(`Incomplete timing data for ${dayName}`);
    return result;
  }

  const appointmentMinutes = timeToMinutes(appointmentTime);
  const openMinutes = timeToMinutes(dayTiming.open);
  const closeMinutes = timeToMinutes(dayTiming.close);

  if (appointmentMinutes < openMinutes) {
    result.valid = false;
    result.errors.push(`Appointment time (${timeToDisplay(appointmentTime)}) is before center opens at ${timeToDisplay(dayTiming.open)}`);
  }

  if (appointmentMinutes > closeMinutes) {
    result.valid = false;
    result.errors.push(`Appointment time (${timeToDisplay(appointmentTime)}) is after center closes at ${timeToDisplay(dayTiming.close)}`);
  }

  if (dayTiming.breakStart && dayTiming.breakEnd) {
    const breakStartMinutes = timeToMinutes(dayTiming.breakStart);
    const breakEndMinutes = timeToMinutes(dayTiming.breakEnd);

    if (appointmentMinutes >= breakStartMinutes && appointmentMinutes < breakEndMinutes) {
      result.valid = false;
      result.errors.push(`Appointment time falls during break period (${timeToDisplay(dayTiming.breakStart)} - ${timeToDisplay(dayTiming.breakEnd)})`);
    }
  }

  return result;
}

export function isCenterOpenOnDate(
  date: Date,
  centerTimings: CenterTimings | null | undefined
): boolean {
  if (!centerTimings) return true;
  
  const dayName = getDayName(date);
  const dayTiming = centerTimings[dayName];
  
  if (!dayTiming) return true;
  return !dayTiming.closed;
}

export function getOpeningHoursForDate(
  date: Date,
  centerTimings: CenterTimings | null | undefined
): TimeSlot | null {
  if (!centerTimings) return null;
  
  const dayName = getDayName(date);
  const dayTiming = centerTimings[dayName];
  
  if (!dayTiming || dayTiming.closed || !dayTiming.open || !dayTiming.close) {
    return null;
  }

  return {
    open: dayTiming.open,
    close: dayTiming.close,
    breakStart: dayTiming.breakStart,
    breakEnd: dayTiming.breakEnd,
  };
}

export function isFridayPrayerTime(appointmentTime: string): boolean {
  const minutes = timeToMinutes(appointmentTime);
  const prayerStart = timeToMinutes("11:30");
  const prayerEnd = timeToMinutes("14:00");
  return minutes >= prayerStart && minutes < prayerEnd;
}

export function getNextAvailableSlot(
  date: Date,
  preferredTime: string,
  centerTimings: CenterTimings | null | undefined
): string | null {
  if (!centerTimings) return preferredTime;

  const dayName = getDayName(date);
  const dayTiming = centerTimings[dayName];

  if (!dayTiming || dayTiming.closed || !dayTiming.open || !dayTiming.close) {
    return null;
  }

  const preferredMinutes = timeToMinutes(preferredTime);
  const openMinutes = timeToMinutes(dayTiming.open);
  const closeMinutes = timeToMinutes(dayTiming.close);

  if (preferredMinutes < openMinutes) {
    return dayTiming.open;
  }

  if (preferredMinutes > closeMinutes) {
    return null;
  }

  if (dayTiming.breakStart && dayTiming.breakEnd) {
    const breakStartMinutes = timeToMinutes(dayTiming.breakStart);
    const breakEndMinutes = timeToMinutes(dayTiming.breakEnd);

    if (preferredMinutes >= breakStartMinutes && preferredMinutes < breakEndMinutes) {
      return dayTiming.breakEnd;
    }
  }

  return preferredTime;
}

export function formatDayTimingForDisplay(dayTiming: DayTiming | undefined): string {
  if (!dayTiming) return "Hours not available";
  if (dayTiming.closed) return "Closed";
  if (!dayTiming.open || !dayTiming.close) return "Hours not available";

  let display = `${timeToDisplay(dayTiming.open)} - ${timeToDisplay(dayTiming.close)}`;
  
  if (dayTiming.breakStart && dayTiming.breakEnd) {
    display += ` (Break: ${timeToDisplay(dayTiming.breakStart)} - ${timeToDisplay(dayTiming.breakEnd)})`;
  }

  return display;
}

export function getAvailableTimeSlots(
  date: Date,
  centerTimings: CenterTimings | null | undefined,
  intervalMinutes: number = 30
): string[] {
  if (!centerTimings) return [];

  const dayName = getDayName(date);
  const dayTiming = centerTimings[dayName];

  if (!dayTiming || dayTiming.closed || !dayTiming.open || !dayTiming.close) {
    return [];
  }

  const slots: string[] = [];
  let currentMinutes = timeToMinutes(dayTiming.open);
  const closeMinutes = timeToMinutes(dayTiming.close);

  const breakStartMinutes = dayTiming.breakStart ? timeToMinutes(dayTiming.breakStart) : null;
  const breakEndMinutes = dayTiming.breakEnd ? timeToMinutes(dayTiming.breakEnd) : null;

  while (currentMinutes <= closeMinutes) {
    const isInBreak = breakStartMinutes !== null && breakEndMinutes !== null &&
      currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes;

    if (!isInBreak) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      slots.push(formatTime(hours, minutes));
    }

    currentMinutes += intervalMinutes;
  }

  return slots;
}
