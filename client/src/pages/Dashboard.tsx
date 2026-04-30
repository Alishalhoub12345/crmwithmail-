import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { flagUrlForNationality } from "@/lib/flags";
import { Users, Dumbbell, UserCheck, DollarSign, TrendingUp, Calendar, Loader2, Cake, Clock3, CalendarDays, Search, ChevronLeft, ChevronRight, Mail, MapPin, Package, Phone, BadgeCheck, TimerReset } from "lucide-react";

interface Stats {
  totalMembers: number;
  totalCoaches: number;
  totalClasses: number;
  totalRevenue: number;
  totalLeads: number;
  activeSubscriptions: number;
  inactiveMemberships: number;
  averageAge: number | null;
  activePtClients: number;
  attendanceToday: number;
  paymentsToday: number;
  monthToDateRevenue: number;
  expiringMemberships: Array<{ id: number; endDate: string; memberName: string; membershipNumber: string | null }>;
  birthdaysToday: Array<{ id: number; memberName: string; birthDate: string }>;
  genderBreakdown: Record<string, number>;
}

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDateForDisplay = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return String(value);
  }

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
};

const dateKey = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
};

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatPackageType = (value?: string | null) =>
  String(value || "membership")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const memberPackageItems = (member: any) => {
  const packages = Array.isArray(member?.packages) ? member.packages : [];

  if (packages.length > 0) {
    return packages.map((pkg: any) => ({
      id: pkg.id ?? pkg.packageId,
      subscriptionId: pkg.subscriptionId,
      name: pkg.name ?? pkg.packageName,
      packageType: pkg.packageType ?? pkg.package_type,
      startDate: pkg.startDate ?? member.membershipStartDate ?? member.joinDate,
      endDate: pkg.endDate ?? member.membershipEndDate,
      status: pkg.status ?? member.status,
      ptSessionsRemaining: Number(pkg.ptSessionsRemaining ?? 0),
    }));
  }

  if (!member?.primaryPackageName) {
    return [];
  }

  return [{
    id: member.primaryPackageId,
    subscriptionId: member.activeSubscriptionId,
    name: member.primaryPackageName,
    packageType: member.primaryPackageType,
    startDate: member.membershipStartDate || member.joinDate,
    endDate: member.membershipEndDate,
    status: member.status,
    ptSessionsRemaining: Number(member.ptSessionsRemaining ?? 0),
  }];
};

const enrollmentStatus = (enrollment: any) => {
  if (enrollment?.attended === true) {
    return "Attended";
  }

  if (enrollment?.attended === false) {
    return "No-show";
  }

  return dateKey(enrollment?.classDate) < todayKey() ? "Pending" : "Enrolled";
};

const enrollmentStatusClass = (status: string) =>
  status === "Attended"
    ? "bg-green-100 text-green-700"
    : status === "No-show"
      ? "bg-red-100 text-red-700"
      : status === "Pending"
        ? "bg-amber-100 text-amber-700"
        : "bg-blue-100 text-blue-700";

const ptSessionStatusLabel = (status?: string | null) =>
  String(status || "scheduled")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace("Pending", "Pending approval");

const ptSessionStatusClass = (status?: string | null) =>
  status === "completed"
    ? "bg-green-100 text-green-700"
    : status === "canceled"
      ? "bg-gray-100 text-gray-600"
      : status === "late_canceled"
        ? "bg-orange-100 text-orange-700"
        : status === "no_show"
          ? "bg-red-100 text-red-700"
          : status === "pending"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-purple-100 text-purple-700";

export default function Dashboard() {
  const { user } = useAuth();
  const [classViewMode, setClassViewMode] = useState<"table" | "calendar">("table");
  const [classSearch, setClassSearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: user?.role === "owner" || user?.role === "admin",
  });

  const { data: classes } = useQuery<any[]>({
    queryKey: ["/api/classes"],
    enabled: user?.role === "owner" || user?.role === "admin",
  });

  const { data: coaches = [], isLoading: isCoachesLoading } = useQuery<any[]>({
    queryKey: ["/api/coaches"],
    enabled: user?.role === "coach",
  });

  const { data: coachClasses = [], isLoading: isCoachClassesLoading } = useQuery<any[]>({
    queryKey: ["/api/classes"],
    enabled: user?.role === "coach",
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery<any[]>({
    queryKey: ["/api/members"],
    enabled: user?.role === "member",
  });

  const currentMember = user?.role === "member"
    ? (members as any[]).find((member: any) => Number(member.userId) === Number(user.id))
    : null;

  const { data: memberEnrollments = [], isLoading: isMemberEnrollmentsLoading } = useQuery<any[]>({
    queryKey: currentMember?.id ? [`/api/class-enrollments/member/${currentMember.id}`] : ["/api/class-enrollments/member/current"],
    enabled: user?.role === "member" && Boolean(currentMember?.id),
  });

  const { data: ptSessions = [], isLoading: isPtSessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/pt-sessions"],
    enabled: (user?.role === "member" && Boolean(currentMember?.id)) || user?.role === "coach",
  });

  const statCards = [
    { label: "Total Members", value: stats?.totalMembers ?? 0, icon: Users, bg: "bg-[#f4b516]/20" },
    { label: "Active Memberships", value: stats?.activeSubscriptions ?? 0, icon: Calendar, bg: "bg-[#f6e8a6]" },
    { label: "Inactive Memberships", value: stats?.inactiveMemberships ?? 0, icon: Clock3, bg: "bg-[#efe7d5]" },
    { label: "Active PT Clients", value: stats?.activePtClients ?? 0, icon: UserCheck, bg: "bg-[#ddd5bf]" },
    { label: "Attendance Today", value: stats?.attendanceToday ?? 0, icon: Dumbbell, bg: "bg-[#f4b516]/25" },
    { label: "Payments Today", value: `$${(stats?.paymentsToday ?? 0).toLocaleString()}`, icon: DollarSign, bg: "bg-[#e6dcc5]" },
    { label: "Month To Date", value: `$${(stats?.monthToDateRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, bg: "bg-[#f6e8a6]" },
    { label: "Average Age", value: stats?.averageAge ?? "-", icon: Cake, bg: "bg-[#efe7d5]" },
  ];

  const genderEntries = Object.entries(stats?.genderBreakdown || {}).filter(([, count]) => count > 0);
  const totalGenderCount = genderEntries.reduce((sum, [, count]) => sum + count, 0);
  const filteredClasses = (classes || [])
    .filter((cls: any) =>
      cls.title?.toLowerCase().includes(classSearch.toLowerCase()) ||
      (cls.coachName || "").toLowerCase().includes(classSearch.toLowerCase()) ||
      (cls.branchName || "").toLowerCase().includes(classSearch.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const first = `${a.classDate || ""}T${a.startTime || "00:00"}`;
      const second = `${b.classDate || ""}T${b.startTime || "00:00"}`;
      return new Date(first).getTime() - new Date(second).getTime();
    });

  const classesByDate = filteredClasses.reduce<Record<string, any[]>>((carry, cls: any) => {
    const key = String(cls.classDate || "");
    if (!key) {
      return carry;
    }

    carry[key] = [...(carry[key] || []), cls].sort((a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")),
    );
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

  const statusColor = (status: string) =>
    status === "scheduled"
      ? "bg-green-100 text-green-700"
      : status === "canceled"
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-600";

  const memberPackages = memberPackageItems(currentMember);
  const totalPtRemaining = Number(currentMember?.ptSessionsRemaining ?? 0) + Number(currentMember?.manualPtCreditsRemaining ?? 0);
  const nationalityFlagUrl = flagUrlForNationality(currentMember?.nationality);
  const sortedMemberEnrollments = (memberEnrollments as any[])
    .slice()
    .sort((a: any, b: any) => {
      const first = `${a.classDate || ""}T${a.startTime || "00:00"}`;
      const second = `${b.classDate || ""}T${b.startTime || "00:00"}`;
      return new Date(first).getTime() - new Date(second).getTime();
    });
  const sortedMemberPtSessions = (ptSessions as any[])
    .filter((session: any) => !["canceled"].includes(String(session.status || "")))
    .slice()
    .sort((a: any, b: any) => {
      const first = `${a.sessionDate || ""}T${a.startTime || "00:00"}`;
      const second = `${b.sessionDate || ""}T${b.startTime || "00:00"}`;
      return new Date(first).getTime() - new Date(second).getTime();
    });
  const memberScheduleEvents = [
    ...sortedMemberEnrollments.map((enrollment: any) => {
      const status = enrollmentStatus(enrollment);

      return {
        id: `class-${enrollment.id}`,
        type: "class",
        title: enrollment.title,
        date: enrollment.classDate,
        startTime: enrollment.startTime,
        endTime: enrollment.endTime,
        coachName: enrollment.coachName,
        branchName: enrollment.branchName,
        status,
        statusClass: enrollmentStatusClass(status),
      };
    }),
    ...sortedMemberPtSessions.map((session: any) => ({
      id: `pt-${session.id}`,
      type: "pt",
      title: "PT Session",
      date: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      coachName: session.coachName,
      branchName: session.branchName,
      status: ptSessionStatusLabel(session.status),
      statusClass: ptSessionStatusClass(session.status),
    })),
  ].sort((a, b) => {
    const first = `${a.date || ""}T${a.startTime || "00:00"}`;
    const second = `${b.date || ""}T${b.startTime || "00:00"}`;
    return new Date(first).getTime() - new Date(second).getTime();
  });
  const upcomingMemberScheduleEvents = memberScheduleEvents.filter((event: any) => dateKey(event.date) >= todayKey());
  const memberScheduleEventsByDate = memberScheduleEvents.reduce<Record<string, any[]>>((carry, event: any) => {
    const key = dateKey(event.date);
    if (!key) {
      return carry;
    }

    carry[key] = [...(carry[key] || []), event].sort((a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")),
    );
    return carry;
  }, {});
  const memberCalendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
      events: memberScheduleEventsByDate[key] || [],
    };
  });

  const currentCoach = user?.role === "coach"
    ? (coaches as any[]).find((coach: any) => Number(coach.userId) === Number(user.id))
    : null;
  const ownCoachClasses = (coachClasses as any[])
    .filter((cls: any) => Number(cls.coachId) === Number(currentCoach?.id))
    .sort((a: any, b: any) => {
      const first = `${a.classDate || ""}T${a.startTime || "00:00"}`;
      const second = `${b.classDate || ""}T${b.startTime || "00:00"}`;
      return new Date(first).getTime() - new Date(second).getTime();
    });
  const ownCoachPtSessions = (ptSessions as any[])
    .filter((session: any) => Number(session.coachId) === Number(currentCoach?.id))
    .sort((a: any, b: any) => {
      const first = `${a.sessionDate || ""}T${a.startTime || "00:00"}`;
      const second = `${b.sessionDate || ""}T${b.startTime || "00:00"}`;
      return new Date(first).getTime() - new Date(second).getTime();
    });
  const coachScheduleEvents = [
    ...ownCoachClasses.map((cls: any) => ({
      id: `coach-class-${cls.id}`,
      type: "class",
      title: cls.title,
      date: cls.classDate,
      startTime: cls.startTime,
      endTime: cls.endTime,
      memberName: "",
      branchName: cls.branchName,
      status: String(cls.status || "active"),
      statusClass: statusColor(String(cls.status || "active")),
    })),
    ...ownCoachPtSessions
      .filter((session: any) => !["canceled"].includes(String(session.status || "")))
      .map((session: any) => ({
        id: `coach-pt-${session.id}`,
        type: "pt",
        title: "PT Session",
        date: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        memberName: session.memberName,
        branchName: session.branchName,
        status: ptSessionStatusLabel(session.status),
        statusClass: ptSessionStatusClass(session.status),
      })),
  ].sort((a, b) => {
    const first = `${a.date || ""}T${a.startTime || "00:00"}`;
    const second = `${b.date || ""}T${b.startTime || "00:00"}`;
    return new Date(first).getTime() - new Date(second).getTime();
  });
  const upcomingCoachEvents = coachScheduleEvents.filter((event: any) => dateKey(event.date) >= todayKey());
  const pendingCoachPtRequests = ownCoachPtSessions.filter((session: any) => session.status === "pending");
  const scheduledCoachPtSessions = ownCoachPtSessions.filter((session: any) => session.status === "scheduled");
  const coachEventsByDate = coachScheduleEvents.reduce<Record<string, any[]>>((carry, event: any) => {
    const key = dateKey(event.date);
    if (!key) {
      return carry;
    }

    carry[key] = [...(carry[key] || []), event].sort((a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")),
    );
    return carry;
  }, {});
  const coachCalendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
      events: coachEventsByDate[key] || [],
    };
  });

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[#ddd5bf] bg-white/80 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-[#181818]">Start Living Right Dashboard</h1>
        <p className="mt-1 text-sm text-[#5f584c]">
          Welcome back, <span className="font-medium text-[#181818]">{user?.name}</span>
          {user?.role !== "owner" && " - viewing your branch"}
        </p>
      </div>

      {user?.role === "member" ? (
        isMembersLoading || isMemberEnrollmentsLoading || isPtSessionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !currentMember ? (
          <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-6 text-sm text-[#8e856f] shadow-sm">
            Member profile not found.
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.4fr]">
              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#181818]">{currentMember.userName || user?.name}</h2>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#8e856f]">
                      {currentMember.uniqueId || "No member ID"}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    currentMember.isFrozen || currentMember.status === "frozen"
                      ? "bg-blue-100 text-blue-700"
                      : currentMember.status === "expired"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                  }`}>
                    {currentMember.isFrozen ? "frozen" : currentMember.status || "active"}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-[#5f584c]">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#8e856f]" />
                    <span className="min-w-0 truncate">{currentMember.userEmail || user?.email || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#8e856f]" />
                    <span>{currentMember.userPhone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#8e856f]" />
                    <span className="min-w-0 truncate">{currentMember.branchName || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#8e856f]" />
                    <span>Joined {formatDateForDisplay(currentMember.joinDate)}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-3">
                    <div className="text-xs text-[#8e856f]">Age</div>
                    <div className="mt-1 text-lg font-semibold text-[#181818]">{currentMember.age ?? "-"}</div>
                  </div>
                  <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-3">
                    <div className="text-xs text-[#8e856f]">Nationality</div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#181818]">
                      {nationalityFlagUrl ? (
                        <img
                          src={nationalityFlagUrl}
                          alt=""
                          className="h-[18px] w-6 shrink-0 rounded-sm border border-[#ddd5bf] object-cover"
                        />
                      ) : null}
                      <span className="truncate">{currentMember.nationality || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[#181818]">Packages</h2>
                  <Package className="h-5 w-5 text-[#8e856f]" />
                </div>

                {memberPackages.length === 0 ? (
                  <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-6 text-sm text-[#8e856f]">
                    No active packages.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {memberPackages.map((pkg: any, index: number) => (
                      <div key={`${pkg.subscriptionId ?? pkg.id}-${index}`} className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#181818]">{pkg.name || "Package"}</div>
                            <div className="mt-1 text-xs text-[#8e856f]">{formatPackageType(pkg.packageType)}</div>
                          </div>
                          <span className="rounded-full bg-[#f4b516]/20 px-2 py-0.5 text-xs font-medium text-[#6d5300]">
                            {pkg.status || "active"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs text-[#5f584c]">
                          <div>
                            <div className="text-[#8e856f]">Start</div>
                            <div className="mt-0.5 font-medium text-[#181818]">{formatDateForDisplay(pkg.startDate)}</div>
                          </div>
                          <div>
                            <div className="text-[#8e856f]">End</div>
                            <div className="mt-0.5 font-medium text-[#181818]">{formatDateForDisplay(pkg.endDate)}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-[#5f584c]">
                          <TimerReset className="h-4 w-4 text-[#8e856f]" />
                          PT remaining: {pkg.ptSessionsRemaining ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Active Packages", value: memberPackages.length, icon: Package },
                { label: "Class Enrollments", value: sortedMemberEnrollments.length, icon: CalendarDays },
                { label: "PT Remaining", value: totalPtRemaining, icon: TimerReset },
                { label: "Attendance Total", value: currentMember.attendanceCount ?? 0, icon: BadgeCheck },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-[22px] border border-[#ddd5bf] bg-white/90 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#6b6253]">{card.label}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4b516]/20">
                        <Icon className="h-4.5 w-4.5 text-[#181818]" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-[#181818]">{card.value}</div>
                  </div>
                );
              })}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between rounded-xl border border-[#efe8d8] bg-[#f8f4ea] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-semibold text-[#181818]">{formatMonthLabel(calendarMonth)}</div>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-2xl border border-[#efe8d8]">
                    {weekdayHeaders.map((day) => (
                      <div key={day} className="border-b border-r border-[#efe8d8] bg-[#f8f4ea] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#7e7562] last:border-r-0">
                        {day}
                      </div>
                    ))}

                    {memberCalendarDays.map((day) => (
                      <div
                        key={day.key}
                        className={`min-h-[126px] border-b border-r border-[#efe8d8] p-2 align-top last:border-r-0 ${day.isCurrentMonth ? "bg-white" : "bg-[#fbf8f0] text-[#b7ae9c]"}`}
                      >
                        <div className="mb-2 text-right text-xs font-semibold">{day.date.getDate()}</div>
                        <div className="space-y-1.5">
                          {day.events.length === 0 ? (
                            <div className="text-[11px] text-[#b7ae9c]">No classes or PT</div>
                          ) : (
                            day.events.map((event: any) => (
                              <div
                                key={event.id}
                                className={`rounded-md border px-2 py-1.5 text-left text-xs text-[#5f584c] ${
                                  event.type === "pt"
                                    ? "border-purple-200 bg-purple-50"
                                    : "border-[#f4b516]/20 bg-[#f4b516]/10"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.type === "pt" ? "bg-purple-500" : "bg-[#f4b516]"}`} />
                                  <div className="truncate font-medium text-[#181818]">{event.title}</div>
                                </div>
                                <div className="text-[11px] text-[#7e7562]">{event.startTime} - {event.endTime}</div>
                                <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${event.statusClass}`}>
                                  {event.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-[#181818]">Upcoming Classes & PT</h2>
                <div className="space-y-3">
                  {upcomingMemberScheduleEvents.length === 0 ? (
                    <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-6 text-sm text-[#8e856f]">
                      No upcoming classes or PT sessions.
                    </div>
                  ) : (
                    upcomingMemberScheduleEvents.slice(0, 8).map((event: any) => (
                        <div key={event.id} className={`rounded-2xl border p-4 ${
                          event.type === "pt"
                            ? "border-purple-200 bg-purple-50"
                            : "border-[#efe8d8] bg-[#fbf8f0]"
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${event.type === "pt" ? "bg-purple-500" : "bg-[#f4b516]"}`} />
                                <div className="truncate text-sm font-semibold text-[#181818]">{event.title}</div>
                              </div>
                              <div className="mt-1 text-xs text-[#8e856f]">{event.coachName || "No personal trainer"}</div>
                            </div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${event.statusClass}`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#5f584c]">
                            <div>
                              <div className="text-[#8e856f]">Date</div>
                              <div className="mt-0.5 font-medium text-[#181818]">{formatDateForDisplay(event.date)}</div>
                            </div>
                            <div>
                              <div className="text-[#8e856f]">Time</div>
                              <div className="mt-0.5 font-medium text-[#181818]">{event.startTime} - {event.endTime}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-[#5f584c]">
                            <MapPin className="h-3.5 w-3.5 text-[#8e856f]" />
                            <span className="truncate">{event.branchName || "-"}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </>
        )
      ) : user?.role === "coach" ? (
        isCoachesLoading || isCoachClassesLoading || isPtSessionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !currentCoach ? (
          <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-6 text-sm text-[#8e856f] shadow-sm">
            Personal trainer profile not found.
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.4fr]">
              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#181818]">{currentCoach.userName || user?.name}</h2>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#8e856f]">
                      {currentCoach.roleTitle || currentCoach.specialization || "Personal Trainer"}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    currentCoach.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {currentCoach.status || "active"}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-[#5f584c]">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#8e856f]" />
                    <span className="min-w-0 truncate">{currentCoach.userEmail || user?.email || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#8e856f]" />
                    <span>{currentCoach.userPhone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#8e856f]" />
                    <span className="min-w-0 truncate">{currentCoach.branchName || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#8e856f]" />
                    <span>Started {formatDateForDisplay(currentCoach.hireDate)}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-3">
                    <div className="text-xs text-[#8e856f]">Commission</div>
                    <div className="mt-1 text-lg font-semibold text-[#181818]">${Number(currentCoach.commissionRate || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-3">
                    <div className="text-xs text-[#8e856f]">Vacation Balance</div>
                    <div className="mt-1 text-lg font-semibold text-[#181818]">{currentCoach.vacationDaysBalance ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-[#181818]">PT Workload</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Pending Requests", value: pendingCoachPtRequests.length, icon: TimerReset },
                    { label: "Scheduled PT", value: scheduledCoachPtSessions.length, icon: UserCheck },
                    { label: "My Classes", value: ownCoachClasses.length, icon: CalendarDays },
                  ].map((card) => {
                    const Icon = card.icon;

                    return (
                      <div key={card.label} className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-[#6b6253]">{card.label}</span>
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4b516]/20">
                            <Icon className="h-4 w-4 text-[#181818]" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[#181818]">{card.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between rounded-xl border border-[#efe8d8] bg-[#f8f4ea] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-semibold text-[#181818]">{formatMonthLabel(calendarMonth)}</div>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-2xl border border-[#efe8d8]">
                    {weekdayHeaders.map((day) => (
                      <div key={day} className="border-b border-r border-[#efe8d8] bg-[#f8f4ea] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#7e7562] last:border-r-0">
                        {day}
                      </div>
                    ))}

                    {coachCalendarDays.map((day) => (
                      <div
                        key={day.key}
                        className={`min-h-[126px] border-b border-r border-[#efe8d8] p-2 align-top last:border-r-0 ${day.isCurrentMonth ? "bg-white" : "bg-[#fbf8f0] text-[#b7ae9c]"}`}
                      >
                        <div className="mb-2 text-right text-xs font-semibold">{day.date.getDate()}</div>
                        <div className="space-y-1.5">
                          {day.events.length === 0 ? (
                            <div className="text-[11px] text-[#b7ae9c]">No classes or PT</div>
                          ) : (
                            day.events.map((event: any) => (
                              <div
                                key={event.id}
                                className={`rounded-md border px-2 py-1.5 text-left text-xs text-[#5f584c] ${
                                  event.type === "pt"
                                    ? "border-purple-200 bg-purple-50"
                                    : "border-[#f4b516]/20 bg-[#f4b516]/10"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.type === "pt" ? "bg-purple-500" : "bg-[#f4b516]"}`} />
                                  <div className="truncate font-medium text-[#181818]">{event.title}</div>
                                </div>
                                <div className="text-[11px] text-[#7e7562]">{event.startTime} - {event.endTime}</div>
                                <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${event.statusClass}`}>
                                  {event.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-[#181818]">Upcoming Work</h2>
                <div className="space-y-3">
                  {upcomingCoachEvents.length === 0 ? (
                    <div className="rounded-2xl border border-[#efe8d8] bg-[#fbf8f0] px-4 py-6 text-sm text-[#8e856f]">
                      No upcoming classes or PT sessions.
                    </div>
                  ) : (
                    upcomingCoachEvents.slice(0, 8).map((event: any) => (
                      <div key={event.id} className={`rounded-2xl border p-4 ${
                        event.type === "pt" ? "border-purple-200 bg-purple-50" : "border-[#efe8d8] bg-[#fbf8f0]"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${event.type === "pt" ? "bg-purple-500" : "bg-[#f4b516]"}`} />
                              <div className="truncate text-sm font-semibold text-[#181818]">{event.title}</div>
                            </div>
                            <div className="mt-1 text-xs text-[#8e856f]">{event.memberName || event.branchName || "-"}</div>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${event.statusClass}`}>
                            {event.status}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#5f584c]">
                          <div>
                            <div className="text-[#8e856f]">Date</div>
                            <div className="mt-0.5 font-medium text-[#181818]">{formatDateForDisplay(event.date)}</div>
                          </div>
                          <div>
                            <div className="text-[#8e856f]">Time</div>
                            <div className="mt-0.5 font-medium text-[#181818]">{event.startTime} - {event.endTime}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-[#5f584c]">
                          <MapPin className="h-3.5 w-3.5 text-[#8e856f]" />
                          <span className="truncate">{event.branchName || "-"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {(user?.role === "owner" || user?.role === "admin") && (
            <>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="stat-card" data-testid={`stat-${card.label.toLowerCase().replace(/ /g, "-")}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#6b6253]">{card.label}</span>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
                          <Icon className="h-4.5 w-4.5 text-[#181818]" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-[#181818]">{card.value}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm lg:col-span-2">
                  <h2 className="mb-4 text-base font-semibold text-[#181818]">Expiring In 14 Days</h2>
                  <div className="space-y-3">
                    {!stats?.expiringMemberships?.length ? (
                      <div className="text-sm text-[#8e856f]">No memberships expiring in the next 14 days.</div>
                    ) : (
                      stats.expiringMemberships.map((membership) => (
                        <div key={membership.id} className="flex items-center justify-between rounded-2xl border border-[#efe8d8] px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-[#181818]">{membership.memberName}</div>
                            <div className="text-xs text-[#7e7562]">{membership.membershipNumber || "No membership number"}</div>
                          </div>
                          <div className="text-xs text-[#6a6357]">{membership.endDate}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                  <h2 className="mb-4 text-base font-semibold text-[#181818]">Gender Mix</h2>
                  <div className="space-y-3">
                    {!genderEntries.length ? (
                      <div className="text-sm text-[#8e856f]">No gender data yet.</div>
                    ) : (
                      genderEntries.map(([gender, count]) => (
                        <div key={gender}>
                          <div className="mb-1 flex items-center justify-between text-sm text-[#181818]">
                            <span className="capitalize">{gender}</span>
                            <span>{Math.round((count / totalGenderCount) * 100)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#efe8d8]">
                            <div className="h-2 rounded-full bg-[#f4b516]" style={{ width: `${(count / totalGenderCount) * 100}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                  <h2 className="mb-4 text-base font-semibold text-[#181818]">Birthdays Today</h2>
                  <div className="space-y-3">
                    {!stats?.birthdaysToday?.length ? (
                      <div className="text-sm text-[#8e856f]">No birthdays today.</div>
                    ) : (
                      stats.birthdaysToday.map((birthday) => (
                        <div key={birthday.id} className="rounded-2xl border border-[#efe8d8] px-4 py-3">
                          <div className="text-sm font-medium text-[#181818]">{birthday.memberName}</div>
                          <div className="text-xs text-[#7e7562]">{birthday.birthDate}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold text-[#181818]">Upcoming Classes</h2>
                    <button
                      type="button"
                      onClick={() => setClassViewMode((current) => (current === "table" ? "calendar" : "table"))}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[#ddd5bf] bg-white px-4 py-2 text-sm font-medium text-[#5f584c] transition-colors hover:bg-[#f8f4ea]"
                    >
                      <CalendarDays className="h-4 w-4" />
                      {classViewMode === "calendar" ? "Table View" : "Calendar View"}
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e856f]" />
                      <input
                        value={classSearch}
                        onChange={(event) => setClassSearch(event.target.value)}
                        placeholder="Search classes..."
                        className="w-full rounded-lg border border-[#ddd5bf] bg-white py-2 pl-9 pr-4 text-sm text-[#181818] focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {!filteredClasses.length ? (
                    <div className="py-8 text-center text-sm text-[#8e856f]">No classes scheduled</div>
                  ) : classViewMode === "calendar" ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between rounded-xl border border-[#efe8d8] bg-[#f8f4ea] px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                          className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="text-sm font-semibold text-[#181818]">{formatMonthLabel(calendarMonth)}</div>
                        <button
                          type="button"
                          onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                          className="rounded-md p-2 text-[#8e856f] transition-colors hover:bg-white hover:text-[#181818]"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[#efe8d8]">
                        {weekdayHeaders.map((day) => (
                          <div key={day} className="border-b border-r border-[#efe8d8] bg-[#f8f4ea] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#7e7562] last:border-r-0">
                            {day}
                          </div>
                        ))}

                        {calendarDays.map((day) => (
                          <div
                            key={day.key}
                            className={`min-h-[120px] border-b border-r border-[#efe8d8] p-2 align-top last:border-r-0 ${day.isCurrentMonth ? "bg-white" : "bg-[#fbf8f0] text-[#b7ae9c]"}`}
                          >
                            <div className="mb-2 text-right text-xs font-semibold">{day.date.getDate()}</div>
                            <div className="space-y-1.5">
                              {day.classes.length === 0 ? (
                                <div className="text-[11px] text-[#b7ae9c]">No classes</div>
                              ) : (
                                day.classes.map((cls: any) => (
                                  <div key={cls.id} className="rounded-md border border-[#f4b516]/20 bg-[#f4b516]/10 px-2 py-1.5 text-left text-xs text-[#5f584c]">
                                    <div className="font-medium text-[#181818]">{cls.title}</div>
                                    <div className="text-[11px] text-[#7e7562]">{cls.startTime} - {cls.endTime}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-[#efe8d8]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#efe8d8] bg-[#f8f4ea]">
                            {["Class", "Personal Trainer", "Date & Time", "Branch", "Capacity", "Status"].map((heading) => (
                              <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#7e7562]">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efe8d8]">
                          {filteredClasses.slice(0, 12).map((cls: any) => (
                            <tr key={cls.id} className="transition-colors hover:bg-[#fcfaf4]" data-testid={`class-row-${cls.id}`}>
                              <td className="px-4 py-3.5">
                                <div className="font-medium text-[#181818]">{cls.title}</div>
                                <div className="text-xs text-[#8e856f] line-clamp-1">{cls.description || "No description"}</div>
                              </td>
                              <td className="px-4 py-3.5 text-[#5f584c]">{cls.coachName || "No personal trainer"}</td>
                              <td className="px-4 py-3.5 text-[#5f584c]">
                                <div>{cls.classDate}</div>
                                <div className="text-xs text-[#8e856f]">{cls.startTime} - {cls.endTime}</div>
                              </td>
                              <td className="px-4 py-3.5 text-[#5f584c]">{cls.branchName}</td>
                              <td className="px-4 py-3.5 text-[#5f584c]">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5 text-[#8e856f]" />
                                  {cls.bookedCount ?? 0}/{cls.capacity}
                                </div>
                                <div className="text-xs text-[#8e856f]">Waitlist: {cls.waitlistCount ?? 0}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(cls.status)}`}>
                                  {cls.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
