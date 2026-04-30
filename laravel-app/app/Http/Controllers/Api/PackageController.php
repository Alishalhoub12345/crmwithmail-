<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PackageController extends Controller
{
    private const BILLING_CYCLE_VALUES = ['1_day', '1_week', '2_weeks', '1_month', '2_months', '3_months', '4_months', '5_months', '6_months', '1_year'];

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = GymPackage::query()
            ->with('branches:id,name')
            ->orderByDesc('id');

        if ($actor->role !== 'owner') {
            $query->where(function ($inner) use ($actor) {
                $inner->where('allows_all_branches', true)
                    ->orWhereNull('branch_id')
                    ->orWhere('branch_id', $actor->branch_id)
                    ->orWhereHas('branches', function ($branchQuery) use ($actor) {
                        $branchQuery->where('branches.id', $actor->branch_id);
                    });
            });
        }

        return response()->json(
            $query->get()->map(fn (GymPackage $package) => $this->transformPackage($package))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $request->merge([
            'billingCycle' => $this->normalizeBillingCycle($request->input('billingCycle')),
        ]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'packageType' => ['nullable', Rule::in(['membership', 'personal_training', 'hybrid'])],
            'tier' => ['nullable', Rule::in(['bronze', 'silver', 'gold'])],
            'billingCycle' => ['nullable', Rule::in(self::BILLING_CYCLE_VALUES)],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
            'durationDays' => ['required', 'integer'],
            'freeMonths' => ['nullable', 'integer', 'min:0', 'max:6'],
            'freeTrialDays' => ['nullable', 'integer', 'min:0', 'max:180'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'branchIds' => ['nullable', 'array'],
            'branchIds.*' => ['integer', 'exists:branches,id'],
            'gymAccessHours' => ['nullable', 'integer'],
            'coachHours' => ['nullable', 'integer'],
            'dietitianHours' => ['nullable', 'integer'],
            'allowsAllBranches' => ['nullable', 'boolean'],
            'sessionsPerWeek' => ['nullable', 'integer'],
            'totalClasses' => ['nullable', 'integer'],
            'includedPtSessions' => ['nullable', 'integer', 'min:0'],
            'allowsFreeze' => ['nullable', 'boolean'],
            'freezeDaysAllowed' => ['nullable', 'integer', 'min:0'],
            'autoRenew' => ['nullable', 'boolean'],
            'includesGymAccess' => ['nullable', 'boolean'],
            'includesClasses' => ['nullable', 'boolean'],
            'selectedClassIds' => ['nullable', 'array'],
            'selectedClassIds.*' => ['integer', 'exists:classes,id'],
            'selectedClassTitles' => ['nullable', 'array'],
            'selectedClassTitles.*' => ['string', 'max:255'],
            'selectedClassCredits' => ['nullable', 'array'],
            'selectedClassCredits.*' => ['integer', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $branchIds = collect($validated['branchIds'] ?? [])
            ->push($validated['branchId'] ?? null)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if (($validated['allowsAllBranches'] ?? false) !== true && $branchIds->isEmpty()) {
            return response()->json(['message' => 'Select at least one branch or enable all branches'], 422);
        }

        $package = GymPackage::query()->create([
            'name' => $validated['name'],
            'package_type' => $validated['packageType'] ?? 'membership',
            'tier' => $validated['tier'] ?? 'bronze',
            'billing_cycle' => $validated['billingCycle'] ?? '1_month',
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'duration_days' => $validated['durationDays'],
            'free_months' => $validated['freeMonths'] ?? 0,
            'free_trial_days' => $validated['freeTrialDays'] ?? 0,
            'branch_id' => ($validated['allowsAllBranches'] ?? false) ? null : $branchIds->first(),
            'gym_access_hours' => $validated['gymAccessHours'] ?? null,
            'coach_hours' => $validated['coachHours'] ?? 0,
            'dietitian_hours' => $validated['dietitianHours'] ?? 0,
            'allows_all_branches' => $validated['allowsAllBranches'] ?? false,
            'sessions_per_week' => $validated['sessionsPerWeek'] ?? null,
            'total_classes' => $validated['totalClasses'] ?? null,
            'included_pt_sessions' => $validated['includedPtSessions'] ?? 0,
            'allows_freeze' => $validated['allowsFreeze'] ?? false,
            'freeze_days_allowed' => $validated['freezeDaysAllowed'] ?? 0,
            'auto_renew' => $validated['autoRenew'] ?? false,
            'includes_gym_access' => $validated['includesGymAccess'] ?? true,
            'includes_classes' => $validated['includesClasses'] ?? true,
            'selected_class_ids' => $validated['selectedClassIds'] ?? null,
            'selected_class_titles' => $validated['selectedClassTitles'] ?? null,
            'selected_class_credits' => $validated['selectedClassCredits'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        $package->branches()->sync(($validated['allowsAllBranches'] ?? false) ? [] : $branchIds->all());

        return response()->json($this->transformPackage($package->fresh()->load('branches:id,name')), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $package = GymPackage::query()->find($id);

        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }

        $request->merge([
            'billingCycle' => $this->normalizeBillingCycle($request->input('billingCycle')),
        ]);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'packageType' => ['nullable', Rule::in(['membership', 'personal_training', 'hybrid'])],
            'tier' => ['nullable', Rule::in(['bronze', 'silver', 'gold'])],
            'billingCycle' => ['nullable', Rule::in(self::BILLING_CYCLE_VALUES)],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric'],
            'durationDays' => ['sometimes', 'required', 'integer'],
            'freeMonths' => ['nullable', 'integer', 'min:0', 'max:6'],
            'freeTrialDays' => ['nullable', 'integer', 'min:0', 'max:180'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'branchIds' => ['nullable', 'array'],
            'branchIds.*' => ['integer', 'exists:branches,id'],
            'gymAccessHours' => ['nullable', 'integer'],
            'coachHours' => ['nullable', 'integer'],
            'dietitianHours' => ['nullable', 'integer'],
            'allowsAllBranches' => ['nullable', 'boolean'],
            'sessionsPerWeek' => ['nullable', 'integer'],
            'totalClasses' => ['nullable', 'integer'],
            'includedPtSessions' => ['nullable', 'integer', 'min:0'],
            'allowsFreeze' => ['nullable', 'boolean'],
            'freezeDaysAllowed' => ['nullable', 'integer', 'min:0'],
            'autoRenew' => ['nullable', 'boolean'],
            'includesGymAccess' => ['nullable', 'boolean'],
            'includesClasses' => ['nullable', 'boolean'],
            'selectedClassIds' => ['nullable', 'array'],
            'selectedClassIds.*' => ['integer', 'exists:classes,id'],
            'selectedClassTitles' => ['nullable', 'array'],
            'selectedClassTitles.*' => ['string', 'max:255'],
            'selectedClassCredits' => ['nullable', 'array'],
            'selectedClassCredits.*' => ['integer', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $branchIds = collect($validated['branchIds'] ?? [])
            ->push($validated['branchId'] ?? null)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if (
            (array_key_exists('branchId', $validated) || array_key_exists('branchIds', $validated) || array_key_exists('allowsAllBranches', $validated))
            && (($validated['allowsAllBranches'] ?? $package->allows_all_branches) !== true)
            && $branchIds->isEmpty()
        ) {
            return response()->json(['message' => 'Select at least one branch or enable all branches'], 422);
        }

        $mapping = [
            'name' => 'name',
            'packageType' => 'package_type',
            'tier' => 'tier',
            'billingCycle' => 'billing_cycle',
            'description' => 'description',
            'price' => 'price',
            'durationDays' => 'duration_days',
            'freeMonths' => 'free_months',
            'freeTrialDays' => 'free_trial_days',
            'branchId' => 'branch_id',
            'gymAccessHours' => 'gym_access_hours',
            'coachHours' => 'coach_hours',
            'dietitianHours' => 'dietitian_hours',
            'allowsAllBranches' => 'allows_all_branches',
            'sessionsPerWeek' => 'sessions_per_week',
            'totalClasses' => 'total_classes',
            'includedPtSessions' => 'included_pt_sessions',
            'allowsFreeze' => 'allows_freeze',
            'freezeDaysAllowed' => 'freeze_days_allowed',
            'autoRenew' => 'auto_renew',
            'includesGymAccess' => 'includes_gym_access',
            'includesClasses' => 'includes_classes',
            'selectedClassIds' => 'selected_class_ids',
            'selectedClassTitles' => 'selected_class_titles',
            'selectedClassCredits' => 'selected_class_credits',
            'status' => 'status',
        ];

        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }

        if (array_key_exists('branchId', $validated) || array_key_exists('branchIds', $validated) || array_key_exists('allowsAllBranches', $validated)) {
            $allowsAllBranches = $validated['allowsAllBranches'] ?? $package->allows_all_branches;
            $payload['branch_id'] = $allowsAllBranches ? null : $branchIds->first();
        }

        $package->fill($payload)->save();
        if (array_key_exists('branchId', $validated) || array_key_exists('branchIds', $validated) || array_key_exists('allowsAllBranches', $validated)) {
            $allowsAllBranches = $validated['allowsAllBranches'] ?? $package->allows_all_branches;
            $package->branches()->sync($allowsAllBranches ? [] : $branchIds->all());
        }

        return response()->json($this->transformPackage($package->fresh()->load('branches:id,name')));
    }

    public function destroy(int $id): JsonResponse
    {
        $package = GymPackage::query()->find($id);

        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }

        $package->delete();

        return response()->json([], 204);
    }

    private function transformPackage(GymPackage $package): array
    {
        return [
            'id' => $package->id,
            'name' => $package->name,
            'packageType' => $package->package_type,
            'tier' => $package->tier,
            'billingCycle' => $package->billing_cycle,
            'description' => $package->description,
            'price' => $package->price,
            'durationDays' => $package->duration_days,
            'freeMonths' => $package->free_months,
            'freeTrialDays' => (int) ($package->free_trial_days ?? 0),
            'branchId' => $package->branch_id,
            'branchIds' => $package->branches->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            'branchNames' => $package->branches->pluck('name')->values()->all(),
            'gymAccessHours' => $package->gym_access_hours,
            'coachHours' => $package->coach_hours,
            'dietitianHours' => $package->dietitian_hours,
            'allowsAllBranches' => (bool) $package->allows_all_branches,
            'sessionsPerWeek' => $package->sessions_per_week,
            'totalClasses' => $package->total_classes,
            'includedPtSessions' => $package->included_pt_sessions,
            'allowsFreeze' => (bool) $package->allows_freeze,
            'freezeDaysAllowed' => $package->freeze_days_allowed,
            'autoRenew' => (bool) $package->auto_renew,
            'includesGymAccess' => (bool) $package->includes_gym_access,
            'includesClasses' => (bool) $package->includes_classes,
            'selectedClassIds' => $package->selected_class_ids,
            'selectedClassTitles' => $package->selected_class_titles,
            'selectedClassCredits' => $package->selected_class_credits,
            'status' => $package->status,
        ];
    }

    private function normalizeBillingCycle(mixed $value): mixed
    {
        if (!is_string($value) || $value === '') {
            return $value;
        }

        $normalized = strtolower(trim($value));

        return match ($normalized) {
            '1_day', '1 day', '1 day pass', 'day pass', 'daily' => '1_day',
            '1_week', '1 week', '1 week pass', 'weekly' => '1_week',
            '2_weeks', '2 weeks', '2 week', '2 week pass', 'two weeks', 'two week pass' => '2_weeks',
            '1_month', '1 month', '1 month pass', '1-month', 'monthly' => '1_month',
            '2_months', '2 months', '2 month pass', '2-months' => '2_months',
            '3_months', '3 months', '3 month pass', '3-months', 'quarterly' => '3_months',
            '4_months', '4 months', '4 month pass', '4-months' => '4_months',
            '5_months', '5 months', '5 month pass', '5-months' => '5_months',
            '6_months', '6 months', '6 month pass', '6-months' => '6_months',
            '1_year', '1 year', '1 year pass', '1-year', 'yearly', 'annual' => '1_year',
            default => $value,
        };
    }
}
