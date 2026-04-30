import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmailLink } from "@/components/ContactLinks";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dumbbell, Plus, Search, Edit2, Trash2, Loader2, X, Users, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const weekdayOptions = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const emptyDaySchedules = weekdayOptions.reduce<Record<string, { startTime: string; endTime: string }>>((carry, day) => {
  carry[day.value] = { startTime: "", endTime: "" };
  return carry;
}, {});

const emptyForm = {
  branchId: "",
  title: "",
  description: "",
  coachId: "",
  classDate: "",
  recurrenceStartDate: "",
  weekdays: [] as string[],
  startTime: "",
  endTime: "",
  sameTimeForAllDays: false,
  daySchedules: emptyDaySchedules,
  capacity: "20",
  enableWaitlist: true,
  priceType: "monthly",
  price: "0",
  status: "active",
  cancellationReason: "",
};

const formatDateForDisplay = (value: string) => {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
};

const normalizeDateInput = (value: string) => value.replace(/[^\d/]/g, "");

const parseDisplayDate = (value: string) => {
  const normalized = value.trim().replace(/-/g, "/");
  const parts = normalized.split("/");

  if (parts.length !== 3) {
    return normalized;
  }

  const [day, month, year] = parts;
  if (day.length < 1 || month.length < 1 || year.length !== 4) {
    return normalized;
  }

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const handleDisplayDateChange = (
  value: string,
  setter: (updater: (current: any) => any) => void,
  key: string,
) => {
  const normalized = normalizeDateInput(value);
  const parsed = parseDisplayDate(normalized);

  setter((current: any) => ({
    ...current,
    [key]: parsed,
  }));
};

const parseIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Classes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [classToDelete, setClassToDelete] = useState<any>(null);
  const [selectedClassForEnrollments, setSelectedClassForEnrollments] = useState<any>(null);
  const [selectedBlockedMemberId, setSelectedBlockedMemberId] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, boolean>>({});

  const { data: classes = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/classes"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: coaches = [] } = useQuery<any[]>({ queryKey: ["/api/coaches"] });
  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/members"],
    enabled: user?.role === "member",
  });

  const currentMember = user?.role === "member"
    ? (members as any[]).find((member: any) => Number(member.userId) === Number(user.id))
    : null;

  const { data: memberEnrollments = [] } = useQuery<any[]>({
    queryKey: currentMember?.id ? [`/api/class-enrollments/member/${currentMember.id}`] : ["/api/class-enrollments/member"],
    enabled: user?.role === "member" && Boolean(currentMember?.id),
  });

  const { data: blockedMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/class-enrollment-blocks"],
    enabled: user?.role === "owner" || user?.role === "admin",
  });

  const { data: classEnrollments = [] } = useQuery<any[]>({
    queryKey: selectedClassForEnrollments?.id ? [`/api/class-enrollments/${selectedClassForEnrollments.id}`] : ["/api/class-enrollments"],
    enabled: Boolean(selectedClassForEnrollments?.id) && (user?.role === "owner" || user?.role === "admin" || user?.role === "coach"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/classes", data).then(r => r.json()),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      closeModal();
      toast({ title: result?.count > 1 ? `${result.count} classes created` : "Class created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/classes/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); closeModal(); toast({ title: "Class updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setClassToDelete(null);
      toast({ title: "Class deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const enrollMutation = useMutation({
    mutationFn: (classId: number) =>
      apiRequest("POST", "/api/class-enrollments/enroll", {
        memberId: currentMember?.id,
        classId,
      }).then((r) => r.json()),
    onSuccess: () => {
      if (currentMember?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/class-enrollments/member/${currentMember.id}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Enrollment submitted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Could not enroll in class", variant: "destructive" }),
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        (classEnrollments as any[]).map((enrollment: any) =>
          apiRequest("POST", "/api/class-enrollments/mark-attendance", {
            enrollmentId: enrollment.id,
            attended: attendanceDraft[Number(enrollment.id)] ?? true,
          }).then((r) => r.json()),
        ),
      );
    },
    onSuccess: () => {
      if (selectedClassForEnrollments?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/class-enrollments/${selectedClassForEnrollments.id}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/class-enrollment-blocks"] });
      toast({ title: "Attendance updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to mark attendance", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: (memberId: number) => apiRequest("POST", "/api/class-enrollment-blocks/unblock", { memberId }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-enrollment-blocks"] });
      setSelectedBlockedMemberId("");
      toast({ title: "Member unblocked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to unblock member", variant: "destructive" }),
  });

  const canManage = user?.role === "owner" || user?.role === "admin";
  const currentCoach = user?.role === "coach"
    ? (coaches as any[]).find((coach: any) => Number(coach.userId) === Number(user.id))
    : null;
  const canReviewEnrollments = user?.role === "owner" || user?.role === "admin" || user?.role === "coach";
  const canMarkClassAttendance = user?.role === "owner" || user?.role === "coach";
  const hasActionColumn = canManage || canReviewEnrollments || user?.role === "member";
  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, branchId: user?.branchId?.toString() || "" }); setShowModal(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    const classDate = c.classDate || "";
    const weekday = classDate ? new Date(`${classDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() : "";
    setForm({
      branchId: c.branchId || "",
      title: c.title || "",
      description: c.description || "",
      coachId: c.coachId || "",
      classDate,
      recurrenceStartDate: classDate,
      weekdays: weekday ? [weekday] : [],
      startTime: c.startTime || "",
      endTime: c.endTime || "",
      sameTimeForAllDays: false,
      daySchedules: {
        ...emptyDaySchedules,
        ...(weekday ? { [weekday]: { startTime: c.startTime || "", endTime: c.endTime || "" } } : {}),
      },
      capacity: c.capacity || "20",
      enableWaitlist: c.enableWaitlist ?? true,
      priceType: "monthly",
      price: c.price || "0",
      status: c.status || "active",
      cancellationReason: c.cancellationReason || "",
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm); };
  const memberEnrollmentByClassId = Object.fromEntries((memberEnrollments as any[]).map((enrollment: any) => [Number(enrollment.classId), enrollment]));

  useEffect(() => {
    if (!selectedClassForEnrollments) {
      setAttendanceDraft({});
      return;
    }

    setAttendanceDraft(Object.fromEntries(
      (classEnrollments as any[]).map((enrollment: any) => [
        Number(enrollment.id),
        enrollment.attended === false ? false : true,
      ]),
    ));
  }, [classEnrollments, selectedClassForEnrollments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isRecurringCreate = !editing && form.weekdays.length > 0 && form.recurrenceStartDate;

    const daySchedules = isRecurringCreate
      ? form.weekdays.map((weekday: string) => ({
          weekday,
          startTime: form.sameTimeForAllDays
            ? form.startTime
            : form.daySchedules?.[weekday]?.startTime || "",
          endTime: form.sameTimeForAllDays
            ? form.endTime
            : form.daySchedules?.[weekday]?.endTime || "",
        }))
      : undefined;

    const data = {
      ...form,
      branchId: form.branchId === "all" ? null : form.branchId ? parseInt(form.branchId, 10) : null,
      coachId: form.coachId ? parseInt(form.coachId) : null,
      capacity: parseInt(form.capacity),
      price: parseFloat(form.price || "0"),
      priceType: "monthly",
      daySchedules,
      startTime: isRecurringCreate ? undefined : form.startTime,
      endTime: isRecurringCreate ? undefined : form.endTime,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = (classes as any[])
    .filter((c: any) => user?.role !== "coach" || Number(c.coachId) === Number(currentCoach?.id))
    .filter((c: any) => {
      const matchesSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.coachName || "").toLowerCase().includes(search.toLowerCase());

      const matchesBranch =
        branchFilter === "all"
          ? true
          : branchFilter === "unassigned"
            ? c.branchId == null
            : String(c.branchId ?? "") === branchFilter;

      return matchesSearch && matchesBranch;
    })
    .sort((left: any, right: any) => {
      const leftDateTime = new Date(`${left.classDate || "9999-12-31"}T${left.startTime || "23:59"}`);
      const rightDateTime = new Date(`${right.classDate || "9999-12-31"}T${right.startTime || "23:59"}`);
      const now = new Date();

      const leftIsUpcoming = leftDateTime >= now;
      const rightIsUpcoming = rightDateTime >= now;

      if (leftIsUpcoming !== rightIsUpcoming) {
        return leftIsUpcoming ? -1 : 1;
      }

      if (leftIsUpcoming && rightIsUpcoming) {
        return leftDateTime.getTime() - rightDateTime.getTime();
      }

      return rightDateTime.getTime() - leftDateTime.getTime();
    });
  const isPending = createMutation.isPending || updateMutation.isPending;
  const showRecurringScheduleBuilder = !editing && form.weekdays.length > 0;
  const classesByDate = filtered.reduce<Record<string, any[]>>((carry, gymClass: any) => {
    const key = String(gymClass.classDate || "");
    if (!key) {
      return carry;
    }

    carry[key] = [...(carry[key] || []), gymClass].sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
    return carry;
  }, {});

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
      classes: classesByDate[key] || [],
    };
  });

  const statusColor = (s: string) => s === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">{classes.length} classes total</p>
        </div>
        {canManage && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => setViewMode((current) => (current === "table" ? "calendar" : "table"))}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              <CalendarDays className="w-4 h-4" /> {viewMode === "calendar" ? "Table View" : "Calendar View"}
            </button>
            <button onClick={openCreate} data-testid="button-add-class"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto">
              <Plus className="w-4 h-4" /> Add Class
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm">
        {(user?.role === "owner" || user?.role === "admin") && (
          <div className="border-b border-border bg-gray-50/70 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Blocked From Class Reservation</h2>
                <p className="mt-1 text-xs text-gray-500">
                  After one no-show the member is warned. On the second no-show they are blocked until the front desk removes it.
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <select
                    value={selectedBlockedMemberId}
                    onChange={(e) => setSelectedBlockedMemberId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select blocked member</option>
                    {(blockedMembers as any[]).map((blocked: any) => (
                      <option key={blocked.blockId} value={blocked.memberId}>
                        {blocked.memberName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedBlockedMemberId || unblockMutation.isPending}
                    onClick={() => unblockMutation.mutate(parseInt(selectedBlockedMemberId, 10))}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(blockedMembers as any[]).length === 0 ? (
                <span className="text-xs text-gray-500">No blocked members.</span>
              ) : (
                (blockedMembers as any[]).map((blocked: any) => (
                  <span key={blocked.blockId} className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                    {blocked.memberName}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative max-w-sm md:max-w-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes..."
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All branches</option>
              {(branches as any[]).map((branch: any) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </option>
              ))}
              <option value="unassigned">All branches / Unassigned</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : viewMode === "calendar" ? (
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold text-gray-800">{formatMonthLabel(calendarMonth)}</div>
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 border border-border bg-gray-50">
              {weekdayHeaders.map((day) => (
                <div key={day} className="border-b border-r border-border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 last:border-r-0">
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => (
                <div
                  key={day.key}
                  className={`min-h-[140px] border-r border-b border-border p-2 align-top last:border-r-0 ${day.isCurrentMonth ? "bg-white" : "bg-gray-50/80 text-gray-400"}`}
                >
                  <div className="mb-2 text-right text-xs font-semibold">{day.date.getDate()}</div>
                  <div className="space-y-1.5">
                    {day.classes.length === 0 ? (
                      <div className="text-xs text-gray-300">No classes</div>
                    ) : (
                      day.classes.map((gymClass: any) => (
                        <button
                          key={gymClass.id}
                          type="button"
                          onClick={() => (canManage ? openEdit(gymClass) : canReviewEnrollments ? setSelectedClassForEnrollments(gymClass) : undefined)}
                          className="w-full rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:border-primary/30 hover:bg-primary/10"
                        >
                          <div className="font-medium text-gray-900">{gymClass.title}</div>
                          <div className="text-[11px] text-gray-500">{gymClass.startTime} - {gymClass.endTime}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {["Class", "Personal Trainer", "Date & Time", "Branch", "Capacity", "Status", ...(hasActionColumn ? [canMarkClassAttendance ? "Attendance" : "Members"] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={hasActionColumn ? 7 : 6} className="px-4 py-10 text-center text-gray-400">No classes found</td></tr>
                ) : filtered.map((c: any) => (
                  <tr key={c.id} data-testid={`class-row-${c.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-900">{c.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{c.coachName || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600">
                      <div>{formatDateForDisplay(c.classDate)}</div>
                      <div className="text-xs text-gray-400">{c.startTime} - {c.endTime}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{c.branchName}</td>
                    <td className="px-4 py-3.5 text-gray-600">
                      <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" /> {c.enrolledCount ?? c.bookedCount ?? 0}/{c.capacity}</div>
                      {(user?.role === "owner" || user?.role === "admin" || user?.role === "coach") && (
                        <div className="text-xs text-gray-400">Attended: {c.attendedCount ?? 0}</div>
                      )}
                      {(user?.role === "owner" || user?.role === "admin" || user?.role === "coach") && (
                        <div className="text-xs text-gray-400">Pending: {c.pendingAttendanceCount ?? 0}</div>
                      )}
                      <div className="text-xs text-gray-400">Waitlist: {c.waitlistCount ?? 0}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
                    </td>
                    {hasActionColumn && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {user?.role === "member" && (() => {
                            const enrollment = memberEnrollmentByClassId[Number(c.id)];
                            if (enrollment) {
                              return (
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                  enrollment.attended === true
                                    ? "bg-green-100 text-green-700"
                                    : enrollment.attended === false
                                      ? "bg-red-100 text-red-700"
                                      : "bg-blue-100 text-blue-700"
                                }`}>
                                  {enrollment.attended === true ? "Attended" : enrollment.attended === false ? "No-show" : "Enrolled"}
                                </span>
                              );
                            }

                            return (
                              <button
                                type="button"
                                disabled={
                                  !currentMember?.id
                                  || enrollMutation.isPending
                                  || c.status !== "active"
                                  || Number(c.enrolledCount ?? c.bookedCount ?? 0) >= Number(c.capacity ?? 0)
                                }
                                onClick={() => enrollMutation.mutate(Number(c.id))}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                {Number(c.enrolledCount ?? c.bookedCount ?? 0) >= Number(c.capacity ?? 0) ? "Full" : "Enroll"}
                              </button>
                            );
                          })()}

                          {canReviewEnrollments && (
                            <button
                              type="button"
                              onClick={() => setSelectedClassForEnrollments(c)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              {canMarkClassAttendance ? "Attendance" : "View Members"}
                            </button>
                          )}

                          {canManage && (
                            <button onClick={() => openEdit(c)} data-testid={`button-edit-class-${c.id}`} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"><Edit2 className="w-4 h-4" /></button>
                          )}
                          {canManage && (
                            <button onClick={() => setClassToDelete(c)} data-testid={`button-delete-class-${c.id}`} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Class" : "Add Class"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select branch</option>
                  {user?.role === "owner" && <option value="all">All branches</option>}
                  {(branches as any[]).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Personal Trainer</label>
                <select value={form.coachId} onChange={(e) => setForm({ ...form, coachId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No personal trainer</option>
                  {(coaches as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.userName}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Class Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Morning Yoga"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              {editing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        value={formatDateForDisplay(form.classDate)}
                        onChange={(e) => handleDisplayDateChange(e.target.value, setForm, "classDate")}
                        required
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                            aria-label="Open date picker"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={parseIsoDate(form.classDate)}
                            onSelect={(date) =>
                              setForm((current: any) => ({
                                ...current,
                                classDate: date
                                  ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                                  : "",
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity</label>
                    <input
                      type="number"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        value={formatDateForDisplay(form.recurrenceStartDate)}
                        onChange={(e) => handleDisplayDateChange(e.target.value, setForm, "recurrenceStartDate")}
                        required
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                            aria-label="Open start date picker"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={parseIsoDate(form.recurrenceStartDate)}
                            onSelect={(date) =>
                              setForm((current: any) => ({
                                ...current,
                                recurrenceStartDate: date
                                  ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                                  : "",
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">The class will start repeating from this date.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Repeat On</label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {weekdayOptions.map((day) => {
                        const active = form.weekdays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setForm((current: any) => ({
                              ...current,
                              weekdays: active
                                ? current.weekdays.filter((value: string) => value !== day.value)
                                : [...current.weekdays, day.value],
                            }))}
                            className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">The class will repeat every selected weekday starting from this date.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity</label>
                    <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}
              {editing ? (
                <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ["startTime", "Start Time", "time"],
                    ["endTime", "End Time", "time"],
                  ].map(([k, l, t]) => (
                    <div key={k}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{l}</label>
                      <input
                        type={t}
                        value={form[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                        required
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                </div>
              ) : showRecurringScheduleBuilder ? (
                <div className="col-span-2 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Time Per Selected Day</label>
                    <p className="mt-1 text-xs text-gray-500">Choose a start and end time for each selected weekday.</p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.sameTimeForAllDays}
                      onChange={(e) =>
                        setForm((current: any) => ({
                          ...current,
                          sameTimeForAllDays: e.target.checked,
                          daySchedules: e.target.checked
                            ? current.daySchedules
                            : Object.fromEntries(
                                Object.entries(current.daySchedules || emptyDaySchedules).map(([weekday, schedule]) => [
                                  weekday,
                                  {
                                    startTime: (schedule as { startTime?: string; endTime?: string }).startTime || current.startTime,
                                    endTime: (schedule as { startTime?: string; endTime?: string }).endTime || current.endTime,
                                  },
                                ]),
                              ),
                        }))
                      }
                      className="rounded"
                    />
                    Use the same start and end time for all selected days
                  </label>

                  {form.sameTimeForAllDays ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Start Time</label>
                        <input
                          type="time"
                          value={form.startTime}
                          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                          required
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">End Time</label>
                        <input
                          type="time"
                          value={form.endTime}
                          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                          required
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weekdayOptions
                        .filter((day) => form.weekdays.includes(day.value))
                        .map((day) => (
                          <div key={day.value} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[90px_1fr_1fr] sm:items-end">
                            <div className="text-sm font-medium text-gray-700">{day.label}</div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Start</label>
                              <input
                                type="time"
                                value={form.daySchedules?.[day.value]?.startTime || ""}
                                onChange={(e) =>
                                  setForm((current: any) => ({
                                    ...current,
                                    daySchedules: {
                                      ...(current.daySchedules || emptyDaySchedules),
                                      [day.value]: {
                                        ...(current.daySchedules?.[day.value] || { startTime: "", endTime: "" }),
                                        startTime: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                required
                                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">End</label>
                              <input
                                type="time"
                                value={form.daySchedules?.[day.value]?.endTime || ""}
                                onChange={(e) =>
                                  setForm((current: any) => ({
                                    ...current,
                                    daySchedules: {
                                      ...(current.daySchedules || emptyDaySchedules),
                                      [day.value]: {
                                        ...(current.daySchedules?.[day.value] || { startTime: "", endTime: "" }),
                                        endTime: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                required
                                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ["startTime", "Start Time", "time"],
                    ["endTime", "End Time", "time"],
                  ].map(([k, l, t]) => (
                    <div key={k}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{l}</label>
                      <input
                        type={t}
                        value={form[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="enableWaitlist" checked={form.enableWaitlist} onChange={(e) => setForm({ ...form, enableWaitlist: e.target.checked })} className="rounded" />
                <label htmlFor="enableWaitlist" className="text-sm text-gray-700">Enable waitlist</label>
              </div>
              {editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              {form.status === "inactive" && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Inactive Reason</label>
                  <textarea value={form.cancellationReason} onChange={(e) => setForm({ ...form, cancellationReason: e.target.value })} rows={2}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              )}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedClassForEnrollments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white p-5">
              <div>
                <h2 className="font-semibold text-gray-900">{canMarkClassAttendance ? "Class Attendance" : "Class Enrollments"}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedClassForEnrollments.title} • {selectedClassForEnrollments.classDate} • {selectedClassForEnrollments.startTime}
                </p>
              </div>
              <button onClick={() => setSelectedClassForEnrollments(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              {(classEnrollments as any[]).length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                  No one enrolled in this class yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {(classEnrollments as any[]).map((enrollment: any) => (
                    <div key={enrollment.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{enrollment.memberName}</div>
                        <div className="text-xs text-gray-500">
                          <EmailLink email={enrollment.memberEmail} className="text-gray-500" />
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Status: {enrollment.attended === true ? "Attended" : enrollment.attended === false ? "No-show" : "Pending personal trainer confirmation"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          enrollment.attended === true
                            ? "bg-green-100 text-green-700"
                            : enrollment.attended === false
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                        }`}>
                          {enrollment.attended === true ? "Attended" : enrollment.attended === false ? "No-show" : "Pending"}
                        </span>

                        {canMarkClassAttendance && (
                          <button
                            type="button"
                            disabled={saveAttendanceMutation.isPending}
                            onClick={() =>
                              setAttendanceDraft((current) => ({
                                ...current,
                                [Number(enrollment.id)]: !(current[Number(enrollment.id)] ?? true),
                              }))
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              (attendanceDraft[Number(enrollment.id)] ?? true)
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            {(attendanceDraft[Number(enrollment.id)] ?? true) ? "Attended" : "No-show"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canMarkClassAttendance && (classEnrollments as any[]).length > 0 && (
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    disabled={saveAttendanceMutation.isPending}
                    onClick={() => saveAttendanceMutation.mutate()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saveAttendanceMutation.isPending ? "Saving..." : "Save Attendance"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {classToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Delete Class</h2>
              <button onClick={() => setClassToDelete(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{classToDelete.title}</span>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Date: {classToDelete.classDate || "-"} {classToDelete.startTime ? `at ${classToDelete.startTime}` : ""}
              </p>
              <p className="mt-1 text-xs text-gray-500">Branch: {classToDelete.branchName || "-"}</p>
              <p className="mt-2 text-xs text-gray-400">This action cannot be undone.</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setClassToDelete(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(classToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Class"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
