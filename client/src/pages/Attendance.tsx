import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Loader2, X } from "lucide-react";

const emptyForm = {
  memberId: "",
  branchId: "",
  classId: "",
  attendanceType: "gym_entry",
  checkinSource: "manual",
  manualOverride: false,
  deviceIdentifier: "",
  notes: "",
};

export default function Attendance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/attendance"] });
  const { data: members = [] } = useQuery<any[]>({ queryKey: ["/api/members"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/attendance", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setShowModal(false);
      setForm(emptyForm);
      toast({ title: "Attendance recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      memberId: parseInt(form.memberId, 10),
      branchId: parseInt(form.branchId, 10) || user?.branchId || 1,
      classId: form.classId ? parseInt(form.classId, 10) : null,
      attendanceType: form.attendanceType,
      checkinSource: form.checkinSource,
      manualOverride: form.manualOverride,
      deviceIdentifier: form.deviceIdentifier || null,
      notes: form.notes,
      markedBy: user?.id,
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">{(records as any[]).length} records total</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="button-add-attendance"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Mark Attendance
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
                  {["Member", "Type", "Source", "Class", "Branch", "Check-in Time", "Access", "Notes"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(records as any[]).length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No attendance records</td></tr>
                ) : (
                  (records as any[]).map((record: any) => (
                    <tr key={record.id} data-testid={`attendance-row-${record.id}`} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5 font-medium text-gray-900">{record.memberName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${record.attendanceType === "gym_entry" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {record.attendanceType === "gym_entry" ? "Gym Entry" : "Class"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{record.checkinSource || "manual"}</td>
                      <td className="px-4 py-3.5 text-gray-600">{record.classTitle || "-"}</td>
                      <td className="px-4 py-3.5 text-gray-600">{record.branchName}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{record.checkinTime ? new Date(record.checkinTime).toLocaleString() : "-"}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${record.accessGranted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {record.accessGranted ? "Granted" : "Blocked"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{record.notes || "-"}</td>
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
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Mark Attendance</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
                <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select member</option>
                  {(members as any[]).map((member: any) => <option key={member.id} value={member.id}>{member.userName}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Attendance Type</label>
                <select value={form.attendanceType} onChange={(e) => setForm({ ...form, attendanceType: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="gym_entry">Gym Entry</option>
                  <option value="class_attendance">Class Attendance</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Check-in Source</label>
                <select value={form.checkinSource} onChange={(e) => setForm({ ...form, checkinSource: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="manual">Manual</option>
                  <option value="face_device">Face Device</option>
                  <option value="system">System</option>
                </select>
              </div>

              {form.attendanceType === "class_attendance" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Class</label>
                  <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select class</option>
                    {(classes as any[]).map((cls: any) => <option key={cls.id} value={cls.id}>{cls.title} - {cls.classDate}</option>)}
                  </select>
                </div>
              )}

              {form.checkinSource === "face_device" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Device Identifier</label>
                  <input type="text" value={form.deviceIdentifier} onChange={(e) => setForm({ ...form, deviceIdentifier: e.target.value })} placeholder="FACE-DEVICE-01" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}

              {user?.role === "owner" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                  <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select branch</option>
                    {(branches as any[]).map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.manualOverride} onChange={(e) => setForm({ ...form, manualOverride: e.target.checked })} className="rounded" />
                Manual override if automatic check-in is blocked
              </label>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setForm(emptyForm); }} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mark
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
