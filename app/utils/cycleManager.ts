export type RecurrenceType = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'expiry';

/**
 * Returns the current timestamp strictly normalized to Indian Standard Time (IST / UTC+05:30),
 * immunizing cycle computations from client OS clock shifts or foreign timezones.
 */
export function getISTDate(dateInput?: Date | string): Date {
  const baseDate = dateInput ? new Date(dateInput) : new Date();
  const utcMillis = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  return new Date(utcMillis + 3600000 * 5.5);
}

/**
 * Generates the deterministic Cycle ID for a poll based on its recurrence type and start anchor.
 */
export function getCurrentCycleId(
  recurrence: string = 'monthly',
  startsAtStr?: string
): string {
  const mode = recurrence.toLowerCase();
  const now = getISTDate();

  if (mode === 'one_time' || mode === 'lifetime' || mode === 'expiry') {
    return 'lifetime';
  }

  // Helper for IST YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. DAILY: Resets at IST midnight
  if (mode === 'daily') {
    return formatLocalDate(now);
  }

  // 2. WEEKLY: Anchored to day-of-week of the poll's start date (IST)
  if (mode === 'weekly') {
    const startDate = startsAtStr ? getISTDate(startsAtStr) : getISTDate(new Date(2026, 0, 1));
    const startDayOfWeek = startDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...

    // Find the most recent startDayOfWeek at or before now
    const currentDayOfWeek = now.getDay();
    const daysSinceCycleStart = (currentDayOfWeek - startDayOfWeek + 7) % 7;
    const cycleStart = new Date(now);
    cycleStart.setDate(now.getDate() - daysSinceCycleStart);
    cycleStart.setHours(0, 0, 0, 0);
    return `W-${formatLocalDate(cycleStart)}`;
  }

  // 3. MONTHLY: Same date next month (no +30 days drift, IST normalized)
  if (mode === 'monthly') {
    const startDay = startsAtStr ? getISTDate(startsAtStr).getDate() : 1;
    const safeStartDay = Math.min(startDay, 28); // Cap at 28 to avoid month length discrepancies

    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (now.getDate() < safeStartDay) {
      // Still in previous month's cycle
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
    const formattedMonth = String(month + 1).padStart(2, '0');
    return `M-${year}-${formattedMonth}-D${safeStartDay}`;
  }

  // 4. QUARTERLY: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
  if (mode === 'quarterly') {
    const startDay = startsAtStr ? getISTDate(startsAtStr).getDate() : 1;
    const safeQuarterDay = Math.min(startDay, 28);
    const year = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    return `Q${currentQuarter}-${year}-D${safeQuarterDay}`;
  }

  // 5. YEARLY: Same date & month next year, active until Dec 31
  if (mode === 'yearly') {
    const startDate = startsAtStr ? getISTDate(startsAtStr) : getISTDate(new Date(now.getFullYear(), 0, 1));
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    return `Y-${now.getFullYear()}-M${startMonth}D${startDay}`;
  }

  return now.toISOString().slice(0, 7);
}

/**
 * Evaluates whether a poll is currently within its active voting window.
 */
export function isPollWithinActiveWindow(poll: {
  starts_at?: string;
  closes_at?: string;
  participation_mode?: string;
  recurrence?: string;
}): boolean {
  const now = getISTDate();

  if (poll.starts_at && getISTDate(poll.starts_at) > now) return false;

  // If traditional Expiry Poll, check closes_at strictly
  if (poll.participation_mode === 'expiry' || poll.recurrence === 'expiry') {
    if (poll.closes_at && getISTDate(poll.closes_at) <= now) return false;
  }

  const mode = (poll.recurrence || 'monthly').toLowerCase();

  // Quarterly window: closes at the end of the quarter
  if (mode === 'quarterly') {
    const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)
    const currentMonth = now.getMonth();
    const currentQuarterIdx = Math.floor(currentMonth / 3);
    const endMonth = quarterEndMonths[currentQuarterIdx];
    const lastDayOfQuarter = new Date(now.getFullYear(), endMonth + 1, 0, 23, 59, 59);
    if (now > lastDayOfQuarter) return false;
  }

  // Yearly window: closes on Dec 31
  if (mode === 'yearly') {
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    if (now > endOfYear) return false;
  }

  return true;
}