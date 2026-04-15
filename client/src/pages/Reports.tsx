import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Reports() {
  const [period, setPeriod] = useState("monthly");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/overview", period],
    queryFn: async () => {
      const res = await fetch(`/api/reports/overview?period=${period}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("gym_crm_token") || ""}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const section = (title: string, entries: Array<[string, any]>) => (
    <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-[#181818]">{title}</h2>
      <div className="space-y-3">
        {entries.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-[#efe8d8] pb-2 text-sm last:border-none last:pb-0">
            <span className="text-[#6a6357]">{label}</span>
            <span className="font-medium text-[#181818]">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Daily, MTD, PT, membership, group exercise, and owner trend reporting</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-10 text-center text-sm text-[#8e856f]">Loading reports...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {section("Daily Report", Object.entries(data?.dailyReport || {}))}
            {section("Month To Date", Object.entries(data?.monthToDateReport || {}))}
            {section("Attendance Report", Object.entries(data?.attendanceReport || {}))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {section("PT Report", Object.entries(data?.ptReport || {}))}
            {section("Membership Report", Object.entries(data?.membershipReport || {}))}
            {section("Group Exercise Report", Object.entries(data?.groupExerciseReport || {}))}
          </div>

          <div className="rounded-[28px] border border-[#ddd5bf] bg-white/90 p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[#181818]">Owner Trends</h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {section("Personal Training", Object.entries(data?.ownerTrends?.personalTraining || {}))}
              {section("Lead Report", Object.entries(data?.ownerTrends?.leadReport || {}))}
              {section("Revenue & Retention", [
                ["Membership Length", data?.ownerTrends?.membershipLength ?? 0],
                ["Avg Monthly Revenue / Member", data?.ownerTrends?.averageMonthlyRevenuePerMember ?? 0],
              ])}
              <div className="rounded-2xl border border-[#efe8d8] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#181818]">Trend Buckets</h3>
                <div className="space-y-3 text-xs text-[#6a6357]">
                  <div>Attendance: {(data?.ownerTrends?.monthlyAttendance || []).length} points</div>
                  <div>Memberships: {(data?.ownerTrends?.monthlyMemberships || []).length} points</div>
                  <div>Group Exercise: {(data?.ownerTrends?.monthlyGroupExercise || []).length} points</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
