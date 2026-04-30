<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubscriptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $memberId = $request->query('memberId');

        $query = DB::table('subscriptions')
            ->leftJoin('packages', 'subscriptions.package_id', '=', 'packages.id')
            ->leftJoin('members', 'subscriptions.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->select([
                'subscriptions.id',
                'subscriptions.member_id as memberId',
                'subscriptions.package_id as packageId',
                'subscriptions.start_date as startDate',
                'subscriptions.end_date as endDate',
                'subscriptions.remaining_classes as remainingClasses',
                'subscriptions.remaining_class_credits as remainingClassCredits',
                'subscriptions.pt_sessions_total as ptSessionsTotal',
                'subscriptions.pt_sessions_used as ptSessionsUsed',
                DB::raw('(subscriptions.pt_sessions_total - subscriptions.pt_sessions_used) as ptSessionsRemaining'),
                'subscriptions.is_frozen as isFrozen',
                'subscriptions.freeze_start_date as freezeStartDate',
                'subscriptions.freeze_end_date as freezeEndDate',
                'subscriptions.freeze_days_used as freezeDaysUsed',
                'subscriptions.renewed_from_subscription_id as renewedFromSubscriptionId',
                'subscriptions.renewed_at as renewedAt',
                'subscriptions.status',
                'subscriptions.created_at as createdAt',
                'packages.name as packageName',
                'packages.package_type as packageType',
                'packages.branch_id as packageBranchId',
                'packages.tier as packageTier',
                'packages.billing_cycle as billingCycle',
                'packages.free_months as freeMonths',
                'packages.gym_access_hours as gymAccessHours',
                'packages.coach_hours as coachHours',
                'packages.dietitian_hours as dietitianHours',
                'packages.allows_all_branches as allowsAllBranches',
                'packages.included_pt_sessions as includedPtSessions',
                'packages.allows_freeze as allowsFreeze',
                'packages.freeze_days_allowed as freezeDaysAllowed',
                'packages.auto_renew as autoRenew',
                'packages.price as packagePrice',
                DB::raw("(select GROUP_CONCAT(DISTINCT pba.branch_id order by pba.branch_id separator ',') from package_branch_access pba where pba.package_id = packages.id) as packageBranchIdsRaw"),
                DB::raw("(select GROUP_CONCAT(DISTINCT branches.name order by branches.name separator ', ') from package_branch_access pba join branches on pba.branch_id = branches.id where pba.package_id = packages.id) as packageBranchNamesRaw"),
                'users.name as memberName',
            ])
            ->orderByDesc('subscriptions.created_at');

        if ($memberId) {
            $query->where('subscriptions.member_id', (int) $memberId);
        }

        return response()->json(
            $query->get()->map(function ($subscription) {
                $branchIds = collect(explode(',', (string) ($subscription->packageBranchIdsRaw ?? '')))
                    ->filter(fn ($value) => $value !== '')
                    ->map(fn ($value) => (int) $value)
                    ->values()
                    ->all();

                $subscription->packageBranchIds = $branchIds !== [] ? $branchIds : array_values(array_filter([(int) ($subscription->packageBranchId ?? 0)]));
                $subscription->packageBranchNames = $subscription->packageBranchNamesRaw ?: null;

                unset($subscription->packageBranchIdsRaw, $subscription->packageBranchNamesRaw);

                return $subscription;
            })
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'packageId' => ['required', 'integer', 'exists:packages,id'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date'],
            'remainingClasses' => ['nullable', 'integer'],
            'remainingClassCredits' => ['nullable', 'array'],
            'ptSessionsTotal' => ['nullable', 'integer', 'min:0'],
            'ptSessionsUsed' => ['nullable', 'integer', 'min:0'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeDaysUsed' => ['nullable', 'integer', 'min:0'],
            'renewedFromSubscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'renewedAt' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'canceled', 'frozen'])],
        ]);

        $package = DB::table('packages')->where('id', $validated['packageId'])->first();

        $subscription = Subscription::query()->create([
            'member_id' => $validated['memberId'],
            'package_id' => $validated['packageId'],
            'start_date' => $validated['startDate'],
            'end_date' => $validated['endDate'],
            'remaining_classes' => $validated['remainingClasses'] ?? null,
            'remaining_class_credits' => $validated['remainingClassCredits'] ?? ($package->selected_class_credits ?? null),
            'pt_sessions_total' => $validated['ptSessionsTotal'] ?? ($package->included_pt_sessions ?? 0),
            'pt_sessions_used' => $validated['ptSessionsUsed'] ?? 0,
            'is_frozen' => $validated['isFrozen'] ?? false,
            'freeze_start_date' => $validated['freezeStartDate'] ?? null,
            'freeze_end_date' => $validated['freezeEndDate'] ?? null,
            'freeze_days_used' => $validated['freezeDaysUsed'] ?? 0,
            'renewed_from_subscription_id' => $validated['renewedFromSubscriptionId'] ?? null,
            'renewed_at' => $validated['renewedAt'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json($subscription, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $subscription = Subscription::query()->find($id);

        if (!$subscription) {
            return response()->json(['message' => 'Subscription not found'], 404);
        }

        $validated = $request->validate([
            'memberId' => ['sometimes', 'required', 'integer', 'exists:members,id'],
            'packageId' => ['sometimes', 'required', 'integer', 'exists:packages,id'],
            'startDate' => ['sometimes', 'required', 'date'],
            'endDate' => ['sometimes', 'required', 'date'],
            'remainingClasses' => ['nullable', 'integer'],
            'remainingClassCredits' => ['nullable', 'array'],
            'ptSessionsTotal' => ['nullable', 'integer', 'min:0'],
            'ptSessionsUsed' => ['nullable', 'integer', 'min:0'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeDaysUsed' => ['nullable', 'integer', 'min:0'],
            'renewedFromSubscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'renewedAt' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'canceled', 'frozen'])],
        ]);

        $mapping = [
            'memberId' => 'member_id',
            'packageId' => 'package_id',
            'startDate' => 'start_date',
            'endDate' => 'end_date',
            'remainingClasses' => 'remaining_classes',
            'remainingClassCredits' => 'remaining_class_credits',
            'ptSessionsTotal' => 'pt_sessions_total',
            'ptSessionsUsed' => 'pt_sessions_used',
            'isFrozen' => 'is_frozen',
            'freezeStartDate' => 'freeze_start_date',
            'freezeEndDate' => 'freeze_end_date',
            'freezeDaysUsed' => 'freeze_days_used',
            'renewedFromSubscriptionId' => 'renewed_from_subscription_id',
            'renewedAt' => 'renewed_at',
            'status' => 'status',
        ];

        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }

        $subscription->fill($payload)->save();

        return response()->json($subscription->fresh());
    }
}
