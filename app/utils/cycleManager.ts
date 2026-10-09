/**
 * Automatically calculates dynamic cycle tag based on poll cadence.
 * Handles auto-advancement for Daily, Weekly, and Monthly recurring polls.
 */
export function getCurrentCycleId(cadence: string = 'monthly'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  switch (cadence.toLowerCase()) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }
    case 'monthly':
    default:
      return `${year}-${month}`;
  }
}

export function getNextCycleDropLabel(cadence: string = 'monthly'): string {
  const now = new Date();
  if (cadence.toLowerCase() === 'daily') {
    return 'Tomorrow 08:00 AM';
  }
  if (cadence.toLowerCase() === 'weekly') {
    return 'Coming Monday 08:00 AM';
  }
  // Monthly: First day of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${nextMonth.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • 08:00 PM`;
}