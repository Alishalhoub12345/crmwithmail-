import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, X, TimerReset } from "lucide-react";

const emptyForm = {
  memberId: "",
  coachId: "",
  branchId: "",
  subscriptionId: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  status: "scheduled",
  notes: "",
  cancellationReason: "",
};

export default function PtSessions() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: sessions = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/pt-sessions"] });
  const { data: members = [] } = useQuery<any[]>({ queryKey: ["/api/members"] });
  const { data: coaches = [] } = useQuery<any[]>({ queryKey: ["/api/coaches"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: subscriptions = [] } = useQuery<any[]>({ queryKey: ["/api/subscriptions"] });

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

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (session: any) => {
    setEditing(session);
    setForm({
      memberId: session.memberId || "",
      coachId: session.coachId || "",
      branchId: session.branchId || "",
      subscriptionId: session.subscriptionId || "",
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
    const data = {
      ...form,
      memberId: parseInt(form.memberId, 10),
      coachId: parseInt(form.coachId, 10),
      branchId: parseInt(form.branchId, 10),
      subscriptionId: parseInt(form.subscriptionId, 10),
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
            : "bg-blue-100 text-blue-700";

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PT Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">Trainer schedules, session delivery, expiry-safe deduction, and late cancellations</p>
        </div>
        <button
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Schedule Session
        </button>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {["Member", "Coach", "Schedule", "PT Balance", "Status", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(sessions as any[]).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No PT sessions scheduled</td></tr>
                ) : (
                  (sessions as any[]).map((session: any) => (
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
                      <td className="px-4 py-3.5 text-gray-600">
                        <div className="text-xs">Used: {session.ptSessionsUsed ?? 0}</div>
                        <div className="text-xs">Remaining: {session.ptSessionsRemaining ?? 0}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => openEdit(session)} className="rounded p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary">
                          <TimerReset className="h-4 w-4" />
                        </button>
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
              <h2 className="font-semibold text-gray-900">{editing ? "Update PT Session" : "Schedule PT Session"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
                <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select member</option>
                  {(members as any[]).map((member: any) => <option key={member.id} value={member.id}>{member.userName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Coach</label>
                <select value={form.coachId} onChange={(e) => setForm({ ...form, coachId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select coach</option>
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
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Subscription</label>
                <select value={form.subscriptionId} onChange={(e) => setForm({ ...form, subscriptionId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select PT subscription</option>
                  {(subscriptions as any[]).map((subscription: any) => (
                    <option key={subscription.id} value={subscription.id}>
                      {subscription.memberName} - {subscription.packageName} ({subscription.ptSessionsTotal - subscription.ptSessionsUsed} left)
                    </option>
                  ))}
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
    </DashboardLayout>
  );
}
