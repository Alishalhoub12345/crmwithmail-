import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmailLink } from "@/components/ContactLinks";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Loader2, X, TimerReset } from "lucide-react";

const emptyForm = {
  memberId: "",
  coachId: "",
  branchId: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  status: "scheduled",
  notes: "",
  cancellationReason: "",
};

export default function PtSessions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManagePt = user?.role === "owner" || user?.role === "admin";
  const isTrainer = user?.role === "coach";
  const [showModal, setShowModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [creditsForm, setCreditsForm] = useState<any>({ memberId: "", creditsToAdd: "" });
  const [form, setForm] = useState<any>(emptyForm);

  const { data: sessions = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/pt-sessions"] });
  const { data: members = [] } = useQuery<any[]>({ queryKey: ["/api/members"], enabled: canManagePt });
  const { data: coaches = [] } = useQuery<any[]>({ queryKey: ["/api/coaches"], enabled: canManagePt });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"], enabled: canManagePt });
  const { data: subscriptions = [] } = useQuery<any[]>({ queryKey: ["/api/subscriptions"], enabled: canManagePt });
  const { data: trainerClasses = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], enabled: isTrainer });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pt-sessions", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      closeModal();
      toast({ title: "PT session created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/pt-sessions/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      closeModal();
      toast({ title: "PT session updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ subscriptionId, data }: any) => apiRequest("PUT", `/api/subscriptions/${subscriptionId}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      setShowCreditsModal(false);
      setCreditsForm({ memberId: "", creditsToAdd: "" });
      toast({ title: "Credits added successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: any) => apiRequest("PUT", `/api/members/${memberId}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setShowCreditsModal(false);
      setCreditsForm({ memberId: "", creditsToAdd: "" });
      toast({ title: "Credits added successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleAddCredits = (memberId: number) => {
    setCreditsForm({ memberId, creditsToAdd: "" });
    setShowCreditsModal(true);
  };

  const handleCreditsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const creditsToAdd = parseInt(creditsForm.creditsToAdd, 10);
    if (!creditsToAdd || creditsToAdd < 1) {
      toast({ title: "Error", description: "Please enter a valid number of credits", variant: "destructive" });
      return;
    }

    const member = (members as any[]).find((item: any) => String(item.id) === String(creditsForm.memberId));
    if (!member) {
      toast({ title: "Error", description: "Member not found", variant: "destructive" });
      return;
    }

    updateMemberMutation.mutate({
      memberId: member.id,
      data: {
        manualPtCreditsTotal: Number(member.manualPtCreditsTotal || 0) + creditsToAdd,
        manualPtCreditsUsed: Number(member.manualPtCreditsUsed || 0),
      }
    });
  };

  const openCreate = () => {
    if (!canManagePt) {
      return;
    }

    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (session: any) => {
    if (!canManagePt) {
      return;
    }

    setEditing(session);
    setForm({
      memberId: session.memberId || "",
      coachId: session.coachId || "",
      branchId: session.branchId || "",
      sessionDate: session.sessionDate || "",
      startTime: session.startTime || "",
      endTime: session.endTime || "",
      status: session.status || "scheduled",
      notes: session.notes || "",
      cancellationReason: session.cancellationReason || "",
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Find the member's subscription with available credits
    // If none available, use any subscription for this member (admin override)
    let memberSubscription = subscriptions.find(
      (sub: any) => String(sub.memberId) === String(form.memberId) && (sub.ptSessionsTotal - sub.ptSessionsUsed) > 0
    );

    // If no subscription with credits, use any subscription for override (admin privilege)
    if (!memberSubscription) {
      memberSubscription = subscriptions.find(
        (sub: any) => String(sub.memberId) === String(form.memberId)
      );
    }

    const selectedMember = (members as any[]).find((member: any) => String(member.id) === String(form.memberId));
    const manualCreditsRemaining = Number(selectedMember?.manualPtCreditsRemaining || 0);

    if (!memberSubscription && manualCreditsRemaining <= 0) {
      toast({ title: "Error", description: "Member has no PT credits", variant: "destructive" });
      return;
    }

    const data = {
      ...form,
      subscriptionId: memberSubscription?.id ?? null,
      memberId: parseInt(form.memberId, 10),
      coachId: parseInt(form.coachId, 10),
      branchId: parseInt(form.branchId, 10),
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }

    createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
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

  const approveSession = (session: any) => {
    if (!canApproveSession(session)) {
      toast({ title: "Time conflict", description: "This request overlaps an existing class or PT session", variant: "destructive" });
      return;
    }

    updateMutation.mutate({ id: session.id, data: { status: "scheduled" } });
  };

  const rejectSession = (session: any) => {
    updateMutation.mutate({
      id: session.id,
      data: {
        status: "canceled",
        cancellationReason: "Rejected by trainer",
      },
    });
  };

  const canCancelSession = (session: any): boolean => {
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

  const overlaps = (left: any, right: any) =>
    String(left.startTime || "") < String(right.endTime || "") &&
    String(left.endTime || "") > String(right.startTime || "");

  const canApproveSession = (session: any): boolean => {
    if (session.status !== "pending") {
      return false;
    }

    const classConflict = (trainerClasses as any[]).some((cls: any) =>
      Number(cls.coachId) === Number(session.coachId) &&
      String(cls.classDate) === String(session.sessionDate) &&
      !["inactive", "canceled"].includes(String(cls.status || "")) &&
      overlaps(
        { startTime: session.startTime, endTime: session.endTime },
        { startTime: cls.startTime, endTime: cls.endTime },
      )
    );

    if (classConflict) {
      return false;
    }

    return !(sessions as any[]).some((other: any) =>
      Number(other.id) !== Number(session.id) &&
      Number(other.coachId) === Number(session.coachId) &&
      String(other.sessionDate) === String(session.sessionDate) &&
      String(other.status) === "scheduled" &&
      overlaps(
        { startTime: session.startTime, endTime: session.endTime },
        { startTime: other.startTime, endTime: other.endTime },
      )
    );
  };

  const sortedSessions = useMemo(
    () =>
      (sessions as any[]).slice().sort((left: any, right: any) => {
        const statusRank = (status: string) => status === "pending" ? 0 : status === "scheduled" ? 1 : 2;
        const rankDelta = statusRank(String(left.status)) - statusRank(String(right.status));
        if (rankDelta !== 0) {
          return rankDelta;
        }

        const first = `${left.sessionDate || ""}T${left.startTime || "00:00"}`;
        const second = `${right.sessionDate || ""}T${right.startTime || "00:00"}`;
        return new Date(first).getTime() - new Date(second).getTime();
      }),
    [sessions],
  );

  const tableHeaders = ["Member", "Personal Trainer", "Requested Time", "Status", "Actions"];

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isTrainer ? "PT Requests" : "PT Sessions"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isTrainer ? "Review member requests and approve only the times you can take" : "Personal trainer schedules, session delivery, expiry-safe deduction, and late cancellations"}
          </p>
        </div>
        {canManagePt && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Schedule Session
          </button>
        )}
      </div>

      {/* Available PT Members Section */}
      {(user?.role === "owner" || user?.role === "admin") && (
        <div className="mb-6 rounded-xl border border-border bg-white shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Available Members for PT Session</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(members as any[])
              .filter((member: any) => member.status === "active" && !member.isFrozen)
              .map((member: any) => {
                const credits = subscriptions
                  .filter((sub: any) => String(sub.memberId) === String(member.id))
                  .reduce((sum: number, sub: any) => sum + (sub.ptSessionsTotal - sub.ptSessionsUsed), 0)
                  + Number(member.manualPtCreditsRemaining || 0);
                return (
                  <div
                    key={member.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col"
                  >
                    <div className="font-medium text-gray-900">{member.userName}</div>
                    <div className="text-sm text-gray-600">
                      <EmailLink email={member.userEmail} className="text-gray-600" />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-primary flex-grow">
                      {credits} Member PT Credits Available
                    </div>
                    <button
                      onClick={() => handleAddCredits(member.id)}
                      className="mt-2 px-3 py-1.5 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                    >
                      +Add Member Credits
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {tableHeaders.map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedSessions.length === 0 ? (
                  <tr><td colSpan={tableHeaders.length} className="px-4 py-10 text-center text-gray-400">{isTrainer ? "No PT requests yet" : "No PT sessions scheduled"}</td></tr>
                ) : (
                  sortedSessions.map((session: any) => (
                    <tr key={session.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{session.memberName}</div>
                        <div className="text-xs text-gray-500">{session.branchName}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{session.coachName}</td>
                      <td className="px-4 py-3.5 text-gray-600">
                        <div>{session.sessionDate}</div>
                        <div className="text-xs text-gray-400">{session.startTime} to {session.endTime}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(session.status)}`}>
                          {statusLabel(session.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {session.status === "pending" ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => approveSession(session)}
                              disabled={updateMutation.isPending || !canApproveSession(session)}
                              title={canApproveSession(session) ? "Approve request" : "Time is no longer available"}
                              className="rounded bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectSession(session)}
                              disabled={updateMutation.isPending}
                              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : canManagePt && canCancelSession(session) ? (
                          <button
                            onClick={() => openEdit(session)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
                            title="Edit/Cancel session"
                          >
                            <TimerReset className="h-4 w-4" />
                          </button>
                        ) : session.status === "scheduled" ? (
                          <div className="text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <span title="Contact admin to cancel within 6 hours of session">Contact Admin</span>
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {getHoursUntilSession(session) <= 0 ? "Session started" : `${Math.round(getHoursUntilSession(session))}h left`}
                            </div>
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

      {showModal && canManagePt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white p-5">
              <h2 className="font-semibold text-gray-900">{editing ? "Update PT Session" : "Schedule PT Session"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
                <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select member</option>
                  {(members as any[])
                    .filter((member: any) => member.status === "active" && !member.isFrozen)
                    .map((member: any) => (
                      <option key={member.id} value={member.id}>
                        {member.userName}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Personal Trainer</label>
                <select value={form.coachId} onChange={(e) => setForm({ ...form, coachId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select personal trainer</option>
                  {(coaches as any[]).map((coach: any) => <option key={coach.id} value={coach.id}>{coach.userName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select branch</option>
                  {(branches as any[]).map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Session Date</label>
                <input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Start Time</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">End Time</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="pending">Pending Approval</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
                  <option value="late_canceled">Late Canceled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Cancellation Reason</label>
                <textarea value={form.cancellationReason} onChange={(e) => setForm({ ...form, cancellationReason: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Update Session" : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border bg-white p-5">
              <h2 className="font-semibold text-gray-900">Add PT Session Credits</h2>
              <button onClick={() => setShowCreditsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreditsSubmit} className="p-5">
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Number of Credits to Add</label>
                <input
                  type="number"
                  min="1"
                  value={creditsForm.creditsToAdd}
                  onChange={(e) => setCreditsForm({ ...creditsForm, creditsToAdd: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter number of credits"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreditsModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={updateSubscriptionMutation.isPending || updateMemberMutation.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {(updateSubscriptionMutation.isPending || updateMemberMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Credits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
