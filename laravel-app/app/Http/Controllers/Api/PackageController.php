<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = GymPackage::query()->orderByDesc('id');

        if ($actor->role !== 'owner') {
            $query->where(function ($inner) use ($actor) {
                $inner->where('branch_id', $actor->branch_id)
                    ->orWhereNull('branch_id');
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'packageType' => ['nullable', Rule::in(['membership', 'personal_training', 'hybrid'])],
            'tier' => ['nullable', Rule::in(['bronze', 'silver', 'gold'])],
            'billingCycle' => ['nullable', Rule::in(['1_month', '3_months', '6_months', '1_year'])],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
            'durationDays' => ['required', 'integer'],
            'freeMonths' => ['nullable', 'integer', 'min:0', 'max:6'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
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

        $package = GymPackage::query()->create([
            'name' => $validated['name'],
            'package_type' => $validated['packageType'] ?? 'membership',
            'tier' => $validated['tier'] ?? 'bronze',
            'billing_cycle' => $validated['billingCycle'] ?? '1_month',
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'duration_days' => $validated['durationDays'],
            'free_months' => $validated['freeMonths'] ?? 0,
            'branch_id' => $validated['branchId'] ?? null,
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

        return response()->json($package, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $package = GymPackage::query()->find($id);

        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'packageType' => ['nullable', Rule::in(['membership', 'personal_training', 'hybrid'])],
            'tier' => ['nullable', Rule::in(['bronze', 'silver', 'gold'])],
            'billingCycle' => ['nullable', Rule::in(['1_month', '3_months', '6_months', '1_year'])],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric'],
            'durationDays' => ['sometimes', 'required', 'integer'],
            'freeMonths' => ['nullable', 'integer', 'min:0', 'max:6'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
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

        $mapping = [
            'name' => 'name',
            'packageType' => 'package_type',
            'tier' => 'tier',
            'billingCycle' => 'billing_cycle',
            'description' => 'description',
            'price' => 'price',
            'durationDays' => 'duration_days',
            'freeMonths' => 'free_months',
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

        $package->fill($payload)->save();

        return response()->json($package->fresh());
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
}
