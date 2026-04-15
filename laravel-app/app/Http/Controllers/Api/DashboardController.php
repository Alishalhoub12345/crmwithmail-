<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $actor = $request->user();
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;

        $memberCount = DB::table('members')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->count();
        $coachCount = DB::table('coaches')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->count();
        $classCount = DB::table('classes')->when($branchId, fn ($q) => $q->where(function ($nested) use ($branchId) {
            $nested
                ->where('branch_id', $branchId)
                ->orWhereNull('branch_id');
        }))->count();
        $paymentSum = DB::table('payments')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->sum('amount');
        $leadCount = DB::table('leads')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->count();
        $activeSubCount = DB::table('subscriptions')
            ->when($branchId, fn ($q) => $q->join('members', 'subscriptions.member_id', '=', 'members.id')->where('members.branch_id', $branchId))
            ->where('subscriptions.status', 'active')
            ->count();
        $inactiveMembershipCount = DB::table('subscriptions')
            ->when($branchId, fn ($q) => $q->join('members', 'subscriptions.member_id', '=', 'members.id')->where('members.branch_id', $branchId))
            ->where('subscriptions.status', 'expired')
            ->count();
        $expiringMemberships = DB::table('subscriptions')
            ->join('members', 'subscriptions.member_id', '=', 'members.id')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->when($branchId, fn ($q) => $q->where('members.branch_id', $branchId))
            ->whereIn('subscriptions.status', ['active', 'frozen'])
            ->whereBetween('subscriptions.end_date', [now()->toDateString(), now()->copy()->addDays(14)->toDateString()])
            ->orderBy('subscriptions.end_date')
            ->limit(8)
            ->get([
                'subscriptions.id',
                'subscriptions.end_date as endDate',
                'users.name as memberName',
                'members.membership_number as membershipNumber',
            ]);
        $birthdaysToday = DB::table('members')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->when($branchId, fn ($q) => $q->where('members.branch_id', $branchId))
            ->whereMonth('members.birth_date', now()->month)
            ->whereDay('members.birth_date', now()->day)
            ->orderBy('users.name')
            ->get([
                'members.id',
                'users.name as memberName',
                'members.birth_date as birthDate',
            ]);
        $genderBreakdown = DB::table('members')
            ->select('gender', DB::raw('count(*) as total'))
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->groupBy('gender')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->gender ?? 'unknown' => (int) $row->total]);
        $averageAge = DB::table('members')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('birth_date')
            ->selectRaw('AVG(TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) as avg_age')
            ->value('avg_age');
        $activePtClients = DB::table('subscriptions')
            ->join('members', 'subscriptions.member_id', '=', 'members.id')
            ->join('packages', 'subscriptions.package_id', '=', 'packages.id')
            ->when($branchId, fn ($q) => $q->where('members.branch_id', $branchId))
            ->where('subscriptions.status', 'active')
            ->where(function ($q) {
                $q->where('packages.package_type', 'personal_training')
                    ->orWhere('packages.package_type', 'hybrid');
            })
            ->count();
        $paymentsToday = DB::table('payments')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereDate('paid_at', now()->toDateString())
            ->sum('amount');
        $monthToDateRevenue = DB::table('payments')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('paid_at', [now()->copy()->startOfMonth()->toDateString(), now()->toDateString()])
            ->sum('amount');
        $attendanceToday = DB::table('attendance')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereDate('checkin_time', now()->toDateString())
            ->count();

        return response()->json([
            'totalMembers' => (int) $memberCount,
            'totalCoaches' => (int) $coachCount,
            'totalClasses' => (int) $classCount,
            'totalRevenue' => (float) ($paymentSum ?? 0),
            'totalLeads' => (int) $leadCount,
            'activeSubscriptions' => (int) $activeSubCount,
            'inactiveMemberships' => (int) $inactiveMembershipCount,
            'averageAge' => $averageAge ? round((float) $averageAge, 1) : null,
            'activePtClients' => (int) $activePtClients,
            'attendanceToday' => (int) $attendanceToday,
            'paymentsToday' => (float) ($paymentsToday ?? 0),
            'monthToDateRevenue' => (float) ($monthToDateRevenue ?? 0),
            'expiringMemberships' => $expiringMemberships,
            'birthdaysToday' => $birthdaysToday,
            'genderBreakdown' => $genderBreakdown,
        ]);
    }
}
