<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $actor = $request->user();
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;
        $period = $request->query('period', 'monthly');

        $trendStart = match ($period) {
            'yearly' => now()->copy()->startOfYear(),
            'quarterly' => now()->copy()->subMonths(2)->startOfMonth(),
            default => now()->copy()->subMonths(5)->startOfMonth(),
        };

        $paymentsBase = DB::table('payments')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $subsBase = DB::table('subscriptions')
            ->when($branchId, fn ($q) => $q->join('members', 'subscriptions.member_id', '=', 'members.id')->where('members.branch_id', $branchId));
        $attendanceBase = DB::table('attendance')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $bookingsBase = DB::table('class_bookings')
            ->join('classes', 'class_bookings.class_id', '=', 'classes.id')
            ->when($branchId, fn ($q) => $q->where(function ($nested) use ($branchId) {
                $nested
                    ->where('classes.branch_id', $branchId)
                    ->orWhereNull('classes.branch_id');
            }));
        $ptBase = DB::table('pt_sessions')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $leadsBase = DB::table('leads')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        $dailyReport = [
            'paymentsToday' => (float) ($paymentsBase->clone()->whereDate('paid_at', now()->toDateString())->sum('amount') ?? 0),
        ];

        $monthToDateReport = [
            'paymentsMonthToDate' => (float) ($paymentsBase->clone()->whereBetween('paid_at', [now()->copy()->startOfMonth()->toDateString(), now()->toDateString()])->sum('amount') ?? 0),
        ];

        $attendanceReport = [
            'checkedInToday' => (int) $attendanceBase->clone()->whereDate('checkin_time', now()->toDateString())->count(),
        ];

        $ptReport = [
            'sessionsConducted' => (int) $ptBase->clone()->where('status', 'completed')->count(),
            'sessionsCanceled' => (int) $ptBase->clone()->where('status', 'canceled')->count(),
            'lateCancellations' => (int) $ptBase->clone()->where('status', 'late_canceled')->count(),
        ];

        $membershipReport = [
            'expiredToday' => (int) $subsBase->clone()->whereDate('end_date', now()->toDateString())->count(),
            'renewedToday' => (int) $subsBase->clone()->whereDate('renewed_at', now()->toDateString())->count(),
            'monthlyOverview' => (int) $subsBase->clone()->whereBetween('start_date', [now()->copy()->startOfMonth()->toDateString(), now()->toDateString()])->count(),
        ];

        $groupExerciseReport = [
            'attendance' => (int) $bookingsBase->clone()->where('class_bookings.status', 'attended')->count(),
            'cancellations' => (int) $bookingsBase->clone()->whereIn('class_bookings.status', ['canceled', 'late_canceled'])->count(),
            'noShow' => (int) $bookingsBase->clone()->where('class_bookings.status', 'no_show')->count(),
            'nextDayBookings' => (int) $bookingsBase->clone()->whereDate('classes.class_date', now()->copy()->addDay()->toDateString())->count(),
        ];

        $ownerTrends = [
            'monthlyAttendance' => $attendanceBase->clone()
                ->selectRaw("DATE_FORMAT(checkin_time, '%Y-%m') as bucket, count(*) as total")
                ->whereDate('checkin_time', '>=', $trendStart->toDateString())
                ->groupBy('bucket')
                ->orderBy('bucket')
                ->get(),
            'monthlyMemberships' => $subsBase->clone()
                ->selectRaw("DATE_FORMAT(start_date, '%Y-%m') as bucket, count(*) as total")
                ->whereDate('start_date', '>=', $trendStart->toDateString())
                ->groupBy('bucket')
                ->orderBy('bucket')
                ->get(),
            'monthlyGroupExercise' => $bookingsBase->clone()
                ->selectRaw("DATE_FORMAT(classes.class_date, '%Y-%m') as bucket, count(*) as attendance")
                ->whereDate('classes.class_date', '>=', $trendStart->toDateString())
                ->where('class_bookings.status', 'attended')
                ->groupBy('bucket')
                ->orderBy('bucket')
                ->get(),
            'personalTraining' => [
                'totalPtSessionsSold' => (int) DB::table('subscriptions')
                    ->when($branchId, fn ($q) => $q->join('members', 'subscriptions.member_id', '=', 'members.id')->where('members.branch_id', $branchId))
                    ->sum('pt_sessions_total'),
                'totalSessionsDelivered' => (int) $ptBase->clone()->where('status', 'completed')->count(),
                'totalLateCancellation' => (int) $ptBase->clone()->where('status', 'late_canceled')->count(),
                'totalCancellation' => (int) $ptBase->clone()->where('status', 'canceled')->count(),
            ],
            'leadReport' => [
                'totalLeads' => (int) $leadsBase->clone()->count(),
                'convertedToMembers' => (int) $leadsBase->clone()->where('status', 'converted')->count(),
            ],
            'membershipLength' => (float) (DB::table('subscriptions')
                ->when($branchId, fn ($q) => $q->join('members', 'subscriptions.member_id', '=', 'members.id')->where('members.branch_id', $branchId))
                ->selectRaw('AVG(DATEDIFF(end_date, start_date)) as avg_len')
                ->value('avg_len') ?? 0),
            'averageMonthlyRevenuePerMember' => (float) (
                (($paymentsBase->clone()->whereDate('paid_at', '>=', now()->copy()->startOfMonth()->toDateString())->sum('amount') ?? 0)) /
                max((int) DB::table('members')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->count(), 1)
            ),
        ];

        return response()->json([
            'dailyReport' => $dailyReport,
            'monthToDateReport' => $monthToDateReport,
            'attendanceReport' => $attendanceReport,
            'ptReport' => $ptReport,
            'membershipReport' => $membershipReport,
            'groupExerciseReport' => $groupExerciseReport,
            'ownerTrends' => $ownerTrends,
        ]);
    }
}
