import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Plus, TimerReset, X } from "lucide-react";

const emptyForm = {
  coachId: "",
  branchId: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  notes: "",
};

const addOneHour = (time: string) => {
  const [hourValue, minuteValue] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return "";
  }

  const nextHour = (hourValue + 1) % 24;
  return `${String(nextHour).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`;
};

const remainingPtCredits = (subscription: any) =>
  Math.max(0, Number(subscription?.ptSessionsTotal || 0) - Number(subscription?.ptSessionsUsed || 0));

const dateWithinSubscription = (subscription: any, sessionDate: string) => {
  if (!sessionDate) {
    return true;
  }

  return String(subscription?.startDate || "") <= sessionDate && sessionDate <= String(subscription?.endDate || "");
};

export default function MemberPtSessions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: sessions = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/pt-sessions"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: members = [] } = useQuery<any[]>({ queryKey: ["/api/members"] });
  const { data: subscriptions = [] } = useQuery<any[]>({ queryKey: ["/api/subscriptions"] });

  const currentMember = useMemo(
    () => (members as any[]).find((member: any) => String(member.userId) === String(user?.id)),
    [members, user?.id],
  );

  const memberBranchIds = useMemo(() => {
    const rawBranchIds = Array.isArray(currentMember?.branchIds) && currentMember.branchIds.length > 0
      ? currentMember.branchIds
      : currentMember?.branchId
        ? [currentMember.branchId]
        : [];

    return rawBranchIds.map((branchId: number | string) => String(branchId));
  }, [currentMember]);

  const memberSubscriptions = useMemo(
    () =>
      (subscriptions as any[]).filter(
        (sub: any) =>
          String(sub.memberId) === String(currentMember?.id) &&
          ["active", "frozen"].includes(String(sub.status || "active")),
      ),
    [currentMember?.id, subscriptions],
  );

  const subscriptionCredits = memberSubscriptions.reduce((sum: number, sub: any) => sum + remainingPtCredits(sub), 0);
  const manualCredits = Number(currentMember?.manualPtCreditsRemaining || 0);
  const availableCredits = subscriptionCredits + manualCredits;

  const branchIdsForSubscription = (subscription: any) => {
    if (subscription?.allowsAllBranches) {
      return (branches as any[]).map((branch: any) => String(branch.id));
    }

    const packageBranchIds = Array.isArray(subscription?.packageBranchIds)
      ? subscription.packageBranchIds.map((branchId: number | string) => String(branchId))
      : [];

    if (packageBranchIds.length > 0) {
      return packageBranchIds;
    }

    if (subscription?.packageBranchId) {
      return [String(subscription.packageBranchId)];
    }

    return memberBranchIds;
  };

  const usablePtSubscriptions = useMemo(
    () => memberSubscriptions.filter((sub: any) => remainingPtCredits(sub) > 0),
    [memberSubscriptions],
  );

  const ptBranchIds = useMemo(() => {
    const ids = new Set<string>();

    usablePtSubscriptions.forEach((sub: any) => {
      branchIdsForSubscription(sub).forEach((branchId: string) => ids.add(branchId));
    });

    if (manualCredits > 0) {
      memberBranchIds.forEach((branchId: string) => ids.add(branchId));
    }

    return Array.from(ids);
  }, [branches, manualCredits, memberBranchIds, usablePtSubscriptions]);

  const branchOptions = useMemo(
    () => (branches as any[]).filter((branch: any) => ptBranchIds.includes(String(branch.id))),
    [branches, ptBranchIds],
  );

  const selectedSubscription = usablePtSubscriptions.find((sub: any) => {
    if (!dateWithinSubscription(sub, form.sessionDate)) {
      return false;
    }

    if (!form.branchId) {
      return true;
    }

    return branchIdsForSubscription(sub).includes(String(form.branchId));
  });

  const manualCreditsCoverBranch = manualCredits > 0 && memberBranchIds.includes(String(form.branchId));
  const hasCreditForSelectedBranch = Boolean(selectedSubscription) || manualCreditsCoverBranch;

  const canLoadAvailableCoaches =
    Boolean(form.branchId && form.sessionDate && form.startTime && form.endTime) &&
    String(form.startTime) < String(form.endTime) &&
    hasCreditForSelectedBranch;

  const availableCoachesUrl = canLoadAvailableCoaches
    ? `/api/pt-sessions/available-coaches?branchId=${encodeURIComponent(form.branchId)}&sessionDate=${encodeURIComponent(form.sessionDate)}&startTime=${encodeURIComponent(form.startTime)}&endTime=${encodeURIComponent(form.endTime)}`
    : "";

  const { data: availableCoaches = [], isFetching: isLoadingCoaches } = useQuery<any[]>({
    queryKey: [availableCoachesUrl],
    enabled: Boolean(availableCoachesUrl),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pt-sessions", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      closeModal();
      toast({ title: "PT request sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (sessionId: number) =>
      apiRequest("PUT", `/api/pt-sessions/${sessionId}`, {
        status: "canceled",
        cancellationReason: "Canceled by member",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "PT session canceled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
  };

  useEffect(() => {
    if (!showModal || !form.branchId || branchOptions.some((branch: any) => String(branch.id) === String(form.branchId))) {
      return;
    }

    setForm((current: any) => ({ ...current, branchId: branchOptions[0]?.id ? String(branchOptions[0].id) : "", coachId: "" }));
  }, [branchOptions, form.branchId, showModal]);

  const openCreate = () => {
    if (!currentMember) {
      toast({ title: "Error", description: "Member profile not found", variant: "destructive" });
      return;
    }

    if (availableCredits <= 0) {
      toast({ title: "Error", description: "You have no PT credits available", variant: "destructive" });
      return;
    }

    setForm({
      ...emptyForm,
      branchId: branchOptions[0]?.id ? String(branchOptions[0].id) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (availableCredits <= 0) {
      toast({ title: "Error", description: "No PT credits available", variant: "destructive" });
      return;
    }

    if (!form.coachId) {
      toast({ title: "Trainer required", description: "Choose an available personal trainer", variant: "destructive" });
      return;
    }

    if (!hasCreditForSelectedBranch) {
      toast({ title: "Branch unavailable", description: "Your PT package does not cover this branch", variant: "destructive" });
      return;
    }

    if (String(form.startTime) >= String(form.endTime)) {
      toast({ title: "Invalid time", description: "End time must be after start time", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      memberId: currentMember?.id,
      coachId: parseInt(form.coachId, 10),
      branchId: parseInt(form.branchId, 10),
      subscriptionId: selectedSubscription?.id ?? null,
      sessionDate: form.sessionDate,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes,
    });
  };

  const isPending = createMutation.isPending;

  const statusColor = (status: string) =>
    status === "completed"
      ? "bg-green-100 text-green-700"
      : status === "late_canceled"
        ? "bg-orange-100 text-orange-700"
        : status === "no_show"
          ? "bg-red-100 text-red-700"
          : status === "canceled"
            ? "bg-gray-100 text-gray-700"
            : status === "pending"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-blue-100 text-blue-700";

  const statusLabel = (status: string) =>
    status === "pending"
      ? "Pending approval"
      : status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

  const canCancelSession = (session: any): boolean => {
    if (session.status === "pending") return true;
    if (session.status !== "scheduled") return false;

    const sessionDateTime = new Date(`${session.sessionDate}T${session.startTime}`);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilSession > 6;
  };

  const getHoursUntilSession = (session: any): number => {
    const sessionDateTime = new Date(`${session.sessionDate}T${session.startTime}`);
    const now = new Date();
    return (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  };

  const memberSessions = (sessions as any[]).filter((session: any) => String(session.memberId) === String(currentMember?.id));

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My PT Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">Request and manage your personal training sessions</p>
        </div>
        {availableCredits > 0 && (
          <button
            onClick={openCreate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Request Session
          </button>
        )}
      </div>

      {availableCredits > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          You have <strong>{availableCredits} PT session credits</strong> available
        </div>
      )}

      {availableCredits === 0 && currentMember && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          No PT session credits available. Contact management to purchase a PT package.
        </div>
      )}

      <div className="rounded-xl border border-border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {["Date & Time", "Personal Trainer", "Branch", "Status", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {memberSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      No PT requests yet
                    </td>
                  </tr>
                ) : (
                  memberSessions.map((session: any) => (
                    <tr key={session.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{session.sessionDate}</div>
                        <div className="text-xs text-gray-500">
                          {session.startTime} to {session.endTime}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{session.coachName}</td>
                      <td className="px-4 py-3.5 text-gray-600">{session.branchName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(session.status)}`}>
                          {statusLabel(session.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {canCancelSession(session) ? (
                          <button
                            onClick={() => cancelMutation.mutate(session.id)}
                            disabled={cancelMutation.isPending}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                            title={session.status === "pending" ? "Cancel request" : "Cancel session"}
                          >
                            <TimerReset className="h-4 w-4" />
                          </button>
                        ) : session.status === "scheduled" ? (
                          <div className="text-xs text-gray-400">
                            <div>{getHoursUntilSession(session) <= 0 ? "Started" : `${Math.round(getHoursUntilSession(session))}h left`}</div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white p-5">
              <h2 className="font-semibold text-gray-900">Request PT Session</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value, coachId: "" })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                >
                  <option value="">Select branch</option>
                  {branchOptions.map((branch: any) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Session Date</label>
                <input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => setForm({ ...form, sessionDate: e.target.value, coachId: "" })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => {
                    const startTime = e.target.value;
                    setForm({ ...form, startTime, endTime: addOneHour(startTime), coachId: "" });
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">Automatically set to 1 hour.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Available Personal Trainers</label>
                <div className="min-h-[96px] rounded-lg border border-gray-200 p-2">
                  {!canLoadAvailableCoaches ? (
                    <div className="px-2 py-8 text-center text-sm text-gray-400">Select a covered branch, date, and start time</div>
                  ) : isLoadingCoaches ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : availableCoaches.length === 0 ? (
                    <div className="px-2 py-8 text-center text-sm text-gray-400">No trainers available for this time</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(availableCoaches as any[]).map((coach: any) => {
                        const selected = String(form.coachId) === String(coach.id);

                        return (
                          <label
                            key={coach.id}
                            onClick={() => setForm({ ...form, coachId: selected ? "" : String(coach.id) })}
                            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                              selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40"
                            }`}
                          >
                            <span>
                              <span className="block text-sm font-medium text-gray-900">{coach.userName}</span>
                              <span className="block text-xs text-gray-500">{coach.branchName || "Personal Trainer"}</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => setForm({ ...form, coachId: selected ? "" : String(coach.id) })}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
