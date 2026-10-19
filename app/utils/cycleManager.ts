export type RecurrenceType = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'expiry';

/**
 * Generates the deterministic Cycle ID for a poll based on its recurrence type and start anchor.
 */
export function getCurrentCycleId(
  recurrence: string = 'monthly',
  startsAtStr?: string
): string {
  const mode = recurrence.toLowerCase();
  const now = new Date();

  if (mode === 'one_time' || mode === 'lifetime' || mode === 'expiry') {
    return 'lifetime';
  }

  // Helper for local YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. DAILY: Resets at local midnight
  if (mode === 'daily') {
    return formatLocalDate(now);
  }

  // 2. WEEKLY: Anchored to day-of-week of the poll's start date
  if (mode === 'weekly') {
    const startDate = startsAtStr ? new Date(startsAtStr) : new Date(2026, 0, 1);
    const startDayOfWeek = startDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...
    
    // Find the most recent startDayOfWeek at or before now
    const currentDayOfWeek = now.getDay();
    const daysSinceCycleStart = (currentDayOfWeek - startDayOfWeek + 7) % 7;
    const cycleStart = new Date(now);
    cycleStart.setDate(now.getDate() - daysSinceCycleStart);
    cycleStart.setHours(0, 0, 0, 0);

    return `W-${cycleStart.toISOString().slice(0, 10)}`;
  }

  // 3. MONTHLY: Same date next month (no +30 days drift)
  if (mode === 'monthly') {
    const startDay = startsAtStr ? new Date(startsAtStr).getDate() : 1;
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
    const startDay = startsAtStr ? new Date(startsAtStr).getDate() : 1;
    const safeQuarterDay = Math.min(startDay, 28); // Excludes 29, 30, 31 as specified
    const year = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    return `Q${currentQuarter}-${year}-D${safeQuarterDay}`;
  }

  // 5. YEARLY: Same date & month next year, active until Dec 31
  if (mode === 'yearly') {
    const startDate = startsAtStr ? new Date(startsAtStr) : new Date(now.getFullYear(), 0, 1);
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
  const now = new Date();
  if (poll.starts_at && new Date(poll.starts_at) > now) return false;

  // If traditional Expiry Poll, check closes_at strictly
  if (poll.participation_mode === 'expiry' || poll.recurrence === 'expiry') {
    if (poll.closes_at && new Date(poll.closes_at) <= now) return false;
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