export interface PollScheduleStatus {
  isCurrentlyLive: boolean;
  statusLabel: 'UPCOMING' | 'ACTIVE' | 'ARCHIVED';
  nextUnlockLabel: string;
  exactUnlockDate: Date | null;
}

export function evaluatePollSchedule(poll: {
  starts_at?: string;
  closes_at?: string;
  is_active?: boolean;
  participation_mode?: string;
  recurrence?: string;
  next_starts_at?: string;
}): PollScheduleStatus {
  const now = new Date();
  const startsAt = poll.starts_at ? new Date(poll.starts_at) : null;
  const isHardDeactivated = poll.is_active === false;

  // 1. If manually paused by admin
  if (isHardDeactivated) {
    return {
      isCurrentlyLive: false,
      statusLabel: 'ARCHIVED',
      nextUnlockLabel: 'Poll paused by governance',
      exactUnlockDate: null,
    };
  }

  // 2. Before initial drop time
  if (startsAt && now < startsAt) {
    const formatted = startsAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      isCurrentlyLive: false,
      statusLabel: 'UPCOMING',
      nextUnlockLabel: `Unlocks on ${formatted}`,
      exactUnlockDate: startsAt,
    };
  }

  // 3. One-Time / Evergreen Polls: Once started, always live
  if (poll.participation_mode === 'one_time' || poll.recurrence === 'lifetime') {
    return {
      isCurrentlyLive: true,
      statusLabel: 'ACTIVE',
      nextUnlockLabel: 'Sovereign One-Time Ballot (No Expiry)',
      exactUnlockDate: null,
    };
  }

  // 4. Recurring / Seasonal Polls
  // Check if admin specified a custom next_starts_at
  if (poll.next_starts_at) {
    const nextDate = new Date(poll.next_starts_at);
    const formatted = nextDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      isCurrentlyLive: true,
      statusLabel: 'ACTIVE',
      nextUnlockLabel: `Next vote on ${formatted}`,
      exactUnlockDate: nextDate,
    };
  }

  // Fallback: Monthly recurrence calculation
  const nextMonthDrop = new Date(now.getFullYear(), now.getMonth() + 1, startsAt ? startsAt.getDate() : 1);
  if (startsAt) {
    nextMonthDrop.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
  }
  const formattedFallback = nextMonthDrop.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    isCurrentlyLive: true,
    statusLabel: 'ACTIVE',
    nextUnlockLabel: `Next vote on ${formattedFallback}`,
    exactUnlockDate: nextMonthDrop,
  };
}