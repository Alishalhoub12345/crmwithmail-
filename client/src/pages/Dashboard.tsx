import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, Dumbbell, UserCheck, DollarSign, TrendingUp, Calendar, Loader2, Cake, Clock3, CalendarDays, Search, ChevronLeft, ChevronRight } from "lucide-react";

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

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[#ddd5bf] bg-white/80 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-[#181818]">Start Living Right Dashboard</h1>
        <p className="mt-1 text-sm text-[#5f584c]">
          Welcome back, <span className="font-medium text-[#181818]">{user?.name}</span>
          {user?.role !== "owner" && " - viewing your branch"}
        </p>
      </div>

      {isLoading ? (
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
                            {["Class", "Coach", "Date & Time", "Branch", "Capacity", "Status"].map((heading) => (
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
                              <td className="px-4 py-3.5 text-[#5f584c]">{cls.coachName || "No coach"}</td>
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
