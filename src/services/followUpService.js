const PRIORITY_INTERVAL_HOURS = {
  Critical: 2,
  High: 6,
  Medium: 24,
  Low: 72
};

const OPEN_STATUSES = new Set(["Queued", "Needs Review", "In Progress", "Escalated"]);

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function intervalHoursForPriority(priority) {
  return PRIORITY_INTERVAL_HOURS[priority] || PRIORITY_INTERVAL_HOURS.Low;
}

function buildFollowUpSchedule(complaint, baseDate = new Date()) {
  const priority = complaint.priority || "Low";
  const hours = intervalHoursForPriority(priority);
  return {
    status: OPEN_STATUSES.has(complaint.status) ? "scheduled" : "closed",
    nextDueAt: OPEN_STATUSES.has(complaint.status) ? addHours(baseDate, hours) : null,
    reason: `${priority} priority follow-up window: ${hours} hour${hours === 1 ? "" : "s"}.`
  };
}

function initializeFollowUp(complaint, baseDate = new Date()) {
  return {
    ...buildFollowUpSchedule(complaint, baseDate),
    lastGeneratedAt: null,
    count: 0,
    escalationNote: ""
  };
}

function refreshComplaintFollowUp(complaint, now = new Date()) {
  if (!OPEN_STATUSES.has(complaint.status)) {
    complaint.followUp = {
      ...(complaint.followUp || {}),
      status: "closed",
      nextDueAt: null,
      escalationNote: "Follow-up closed because the complaint is no longer open."
    };
    return false;
  }

  if (!complaint.followUp?.nextDueAt) {
    complaint.followUp = {
      ...(complaint.followUp || {}),
      ...buildFollowUpSchedule(complaint, complaint.createdAt ? new Date(complaint.createdAt) : now)
    };
    return true;
  }

  const nextDueAt = new Date(complaint.followUp.nextDueAt);
  if (nextDueAt > now) {
    complaint.followUp.status = "scheduled";
    return false;
  }

  const lastGeneratedAt = complaint.followUp.lastGeneratedAt
    ? new Date(complaint.followUp.lastGeneratedAt)
    : null;
  if (lastGeneratedAt && lastGeneratedAt >= nextDueAt) {
    complaint.followUp.status = "due";
    return false;
  }

  const count = Number(complaint.followUp.count || 0) + 1;
  const note = `Auto follow-up ${count}: ${complaint.priority} priority ${complaint.type} at ${complaint.location} is still ${complaint.status}.`;
  complaint.followUp = {
    ...(complaint.followUp || {}),
    status: count >= 2 ? "overdue" : "due",
    lastGeneratedAt: now,
    nextDueAt: addHours(now, intervalHoursForPriority(complaint.priority)),
    count,
    escalationNote: note,
    reason: buildFollowUpSchedule(complaint, now).reason
  };
  complaint.alerts = [...(complaint.alerts || []), note];
  complaint.statusHistory = [
    ...(complaint.statusHistory || []),
    {
      status: complaint.status,
      changedBy: "auto-follow-up",
      changedAt: now,
      note
    }
  ];

  return true;
}

async function refreshFollowUpsForComplaints(complaints, now = new Date()) {
  const changed = [];
  complaints.forEach((complaint) => {
    if (refreshComplaintFollowUp(complaint, now)) {
      changed.push(complaint);
    }
  });

  await Promise.all(changed.map((complaint) => complaint.save()));
  return changed.length;
}

module.exports = {
  buildFollowUpSchedule,
  initializeFollowUp,
  refreshComplaintFollowUp,
  refreshFollowUpsForComplaints
};
