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

  // 1. Hard Deactivated by Admin
  if (isHardDeactivated) {
    return {
      isCurrentlyLive: false,
      statusLabel: 'ARCHIVED',
      nextUnlockLabel: 'Poll paused by governance',
      exactUnlockDate: null,
    };
  }

  // 2. Before Initial Drop Time (Future Poll)
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

  // 3. One-Time / Evergreen Polls: Once started, always live with no expiry
  if (poll.participation_mode === 'one_time' || poll.recurrence === 'lifetime') {
    return {
      isCurrentlyLive: true,
      statusLabel: 'ACTIVE',
      nextUnlockLabel: 'Sovereign One-Time Ballot (No Expiry)',
      exactUnlockDate: null,
    };
  }

  // 4. Traditional Expiry Polls
  if ((poll.participation_mode === 'expiry' || poll.recurrence === 'expiry') && poll.closes_at) {
    const closesAt = new Date(poll.closes_at);
    if (now >= closesAt) {
      return {
        isCurrentlyLive: false,
        statusLabel: 'ARCHIVED',
        nextUnlockLabel: `Concluded on ${closesAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        exactUnlockDate: closesAt,
      };
    }
  }

  // 5. Recurring / Seasonal Polls (with custom next_starts_at reschedule support)
  if (poll.next_starts_at) {
    const nextDrop = new Date(poll.next_starts_at);
    // If we have entered a new calendar month but have not reached the scheduled next drop date yet
    if (now < nextDrop && now.getDate() < nextDrop.getDate()) {
      const formatted = nextDrop.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        isCurrentlyLive: false,
        statusLabel: 'UPCOMING',
        nextUnlockLabel: `Next Cycle: ${formatted}`,
        exactUnlockDate: nextDrop,
      };
    }
  }

  // 6. Active Live Recurring Poll
  const anchorDay = startsAt ? startsAt.getDate() : 1;
  const safeAnchorDay = Math.min(anchorDay, 28);
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();
  if (now.getDate() >= safeAnchorDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  const nextCycleDate = new Date(targetYear, targetMonth, safeAnchorDay);
  if (startsAt) {
    nextCycleDate.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
  }
  const formattedNext = nextCycleDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    isCurrentlyLive: true,
    statusLabel: 'ACTIVE',
    nextUnlockLabel: `Next vote on ${formattedNext}`,
    exactUnlockDate: nextCycleDate,
  };
}