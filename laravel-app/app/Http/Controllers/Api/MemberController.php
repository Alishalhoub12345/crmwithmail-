<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = $this->memberBaseQuery()
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('branches', 'members.branch_id', '=', 'branches.id')
            ->leftJoin('packages', 'members.primary_package_id', '=', 'packages.id')
            ->leftJoin('subscriptions as active_subscription', function ($join) {
                $join->on('active_subscription.member_id', '=', 'members.id')
                    ->where('active_subscription.status', '=', 'active');
            })
            ->select([
                'members.id',
                'members.user_id as userId',
                'members.branch_id as branchId',
                'members.primary_package_id as primaryPackageId',
                'members.first_name as firstName',
                'members.middle_name as middleName',
                'members.last_name as lastName',
                'members.membership_number as membershipNumber',
                'members.unique_id as uniqueId',
                'members.gender',
                'members.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, members.birth_date, CURDATE()) as age'),
                'members.nationality',
                'members.emergency_contact as emergencyContact',
                'members.emergency_contact_name as emergencyContactName',
                'members.emergency_contact_phone as emergencyContactPhone',
                'members.join_date as joinDate',
                'members.status',
                'members.is_frozen as isFrozen',
                'members.freeze_start_date as freezeStartDate',
                'members.freeze_end_date as freezeEndDate',
                'members.freeze_notes as freezeNotes',
                'members.notes',
                'members.height',
                'members.weight',
                'members.fitness_goal as fitnessGoal',
                DB::raw('(select count(*) from attendance where attendance.member_id = members.id) as attendanceCount'),
                DB::raw('(select count(*) from attendance where attendance.member_id = members.id and date(attendance.checkin_time) = CURDATE()) as attendanceToday'),
                'users.name as userName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'branches.name as branchName',
                'packages.name as primaryPackageName',
                'packages.package_type as primaryPackageType',
                'packages.tier as primaryPackageTier',
                'packages.billing_cycle as primaryPackageCycle',
                DB::raw("(select GROUP_CONCAT(DISTINCT classes.title order by classes.title separator ', ') from class_bookings left join classes on class_bookings.class_id = classes.id where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) as classTitles"),
                DB::raw("(select count(distinct class_bookings.class_id) from class_bookings where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) as classCount"),
                DB::raw("CASE WHEN (select count(*) from class_bookings where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) > 0 THEN DATE_SUB(DATE_ADD(members.join_date, INTERVAL 1 MONTH), INTERVAL 1 DAY) ELSE NULL END as classMembershipEndDate"),
                'active_subscription.id as activeSubscriptionId',
                'active_subscription.start_date as membershipStartDate',
                'active_subscription.end_date as membershipEndDate',
                'active_subscription.remaining_class_credits as remainingClassCredits',
                'active_subscription.pt_sessions_total as ptSessionsTotal',
                'active_subscription.pt_sessions_used as ptSessionsUsed',
                DB::raw('(active_subscription.pt_sessions_total - active_subscription.pt_sessions_used) as ptSessionsRemaining'),
            ])
            ->orderByDesc('members.id');

        if ($actor->role !== 'owner') {
            $query->where('members.branch_id', $actor->branch_id);
        }

        return response()->json($query->get());
    }

    public function show(int $id): JsonResponse
    {
        $member = $this->memberBaseQuery()
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('branches', 'members.branch_id', '=', 'branches.id')
            ->leftJoin('packages', 'members.primary_package_id', '=', 'packages.id')
            ->leftJoin('subscriptions as active_subscription', function ($join) {
                $join->on('active_subscription.member_id', '=', 'members.id')
                    ->whereIn('active_subscription.status', ['active', 'frozen']);
            })
            ->select([
                'members.id',
                'members.user_id as userId',
                'members.branch_id as branchId',
                'members.primary_package_id as primaryPackageId',
                'members.first_name as firstName',
                'members.middle_name as middleName',
                'members.last_name as lastName',
                'members.membership_number as membershipNumber',
                'members.unique_id as uniqueId',
                'members.gender',
                'members.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, members.birth_date, CURDATE()) as age'),
                'members.nationality',
                'members.emergency_contact as emergencyContact',
                'members.emergency_contact_name as emergencyContactName',
                'members.emergency_contact_phone as emergencyContactPhone',
                'members.join_date as joinDate',
                'members.status',
                'members.is_frozen as isFrozen',
                'members.freeze_start_date as freezeStartDate',
                'members.freeze_end_date as freezeEndDate',
                'members.freeze_notes as freezeNotes',
                'members.notes',
                'members.height',
                'members.weight',
                'members.fitness_goal as fitnessGoal',
                DB::raw('(select count(*) from attendance where attendance.member_id = members.id) as attendanceCount'),
                DB::raw('(select count(*) from attendance where attendance.member_id = members.id and date(attendance.checkin_time) = CURDATE()) as attendanceToday'),
                'users.name as userName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'branches.name as branchName',
                'packages.name as primaryPackageName',
                'packages.package_type as primaryPackageType',
                'packages.tier as primaryPackageTier',
                'packages.billing_cycle as primaryPackageCycle',
                DB::raw("(select GROUP_CONCAT(DISTINCT classes.title order by classes.title separator ', ') from class_bookings left join classes on class_bookings.class_id = classes.id where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) as classTitles"),
                DB::raw("(select count(distinct class_bookings.class_id) from class_bookings where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) as classCount"),
                DB::raw("CASE WHEN (select count(*) from class_bookings where class_bookings.member_id = members.id and class_bookings.status in ('booked','attended','waitlisted')) > 0 THEN DATE_SUB(DATE_ADD(members.join_date, INTERVAL 1 MONTH), INTERVAL 1 DAY) ELSE NULL END as classMembershipEndDate"),
                'active_subscription.id as activeSubscriptionId',
                'active_subscription.start_date as membershipStartDate',
                'active_subscription.end_date as membershipEndDate',
                'active_subscription.remaining_class_credits as remainingClassCredits',
                'active_subscription.pt_sessions_total as ptSessionsTotal',
                'active_subscription.pt_sessions_used as ptSessionsUsed',
                DB::raw('(active_subscription.pt_sessions_total - active_subscription.pt_sessions_used) as ptSessionsRemaining'),
            ])
            ->where('members.id', $id)
            ->first();

        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        return response()->json($member);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'middleName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'serviceType' => ['nullable', Rule::in(['package', 'class', 'personal_training'])],
            'packageId' => ['nullable', 'integer', 'exists:packages,id'],
            'classId' => ['nullable', 'integer', 'exists:classes,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'membershipNumber' => ['nullable', 'string', 'max:100'],
            'uniqueId' => ['nullable', 'string', 'max:100', 'unique:members,unique_id'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContact' => ['nullable', 'string', 'max:255'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'joinDate' => ['nullable', 'date'],
            'membershipEndDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'frozen'])],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'height' => ['nullable', 'numeric'],
            'weight' => ['nullable', 'numeric'],
            'fitnessGoal' => ['nullable', 'string'],
        ]);

        $serviceType = $validated['serviceType'] ?? 'package';

        if ($serviceType === 'class' && empty($validated['classId'])) {
            return response()->json(['message' => 'Selected class is required'], 422);
        }

        if ($serviceType !== 'class' && empty($validated['packageId'])) {
            return response()->json(['message' => 'Selected package is required'], 422);
        }

        $package = null;
        if (!empty($validated['packageId'])) {
            $package = DB::table('packages')->where('id', $validated['packageId'])->first();
            if (!$package || $package->status !== 'active') {
                return response()->json(['message' => 'Selected package is not available'], 400);
            }

            if (!$package->allows_all_branches && $package->branch_id && (int) $package->branch_id !== (int) $validated['branchId']) {
                return response()->json(['message' => 'Selected package does not belong to the chosen branch'], 400);
            }
        }

        [$member, $user] = DB::transaction(function () use ($validated, $package) {
            $user = User::query()->create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password'] ?? 'Member@2024'),
                'role' => 'member',
                'branch_id' => $validated['branchId'],
                'status' => 'active',
            ]);

            $member = Member::query()->create([
                'user_id' => $user->id,
                'branch_id' => $validated['branchId'],
                'primary_package_id' => $validated['packageId'] ?? null,
                'first_name' => $validated['firstName'] ?? $this->extractFirstName($validated['name']),
                'middle_name' => $validated['middleName'] ?? $this->extractMiddleName($validated['name']),
                'last_name' => $validated['lastName'] ?? $this->extractLastName($validated['name']),
                'membership_number' => $validated['membershipNumber'] ?? null,
                'unique_id' => $validated['uniqueId'] ?? $this->generateUniqueId('members'),
                'gender' => $validated['gender'] ?? null,
                'birth_date' => $validated['birthDate'] ?? null,
                'nationality' => $validated['nationality'] ?? null,
                'emergency_contact' => $validated['emergencyContact'] ?? null,
                'emergency_contact_name' => $validated['emergencyContactName'] ?? null,
                'emergency_contact_phone' => $validated['emergencyContactPhone'] ?? null,
                'join_date' => $validated['joinDate'] ?? now()->toDateString(),
                'status' => $validated['status'] ?? 'active',
                'is_frozen' => $validated['isFrozen'] ?? false,
                'freeze_start_date' => $validated['freezeStartDate'] ?? null,
                'freeze_end_date' => $validated['freezeEndDate'] ?? null,
                'freeze_notes' => $validated['freezeNotes'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'height' => $validated['height'] ?? null,
                'weight' => $validated['weight'] ?? null,
                'fitness_goal' => $validated['fitnessGoal'] ?? null,
            ]);

            if ($package) {
                $startDate = $validated['joinDate'] ?? now()->toDateString();
                $durationDays = max(((int) $package->duration_days) - 1, 0);
                $endDate = $validated['membershipEndDate'] ?? now()->parse($startDate)->addDays($durationDays)->toDateString();

                Subscription::query()->create([
                    'member_id' => $member->id,
                    'package_id' => $package->id,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'remaining_classes' => $package->total_classes,
                    'remaining_class_credits' => json_decode($package->selected_class_credits ?? 'null', true),
                    'pt_sessions_total' => $package->included_pt_sessions ?? 0,
                    'pt_sessions_used' => 0,
                    'is_frozen' => $validated['isFrozen'] ?? false,
                    'freeze_start_date' => $validated['freezeStartDate'] ?? null,
                    'freeze_end_date' => $validated['freezeEndDate'] ?? null,
                    'freeze_days_used' => 0,
                    'status' => ($validated['isFrozen'] ?? false) ? 'frozen' : 'active',
                ]);
            }

            return [$member, $user];
        });

        return response()->json([
            'id' => $member->id,
            'userId' => $member->user_id,
            'branchId' => $member->branch_id,
            'primaryPackageId' => $member->primary_package_id,
            'firstName' => $member->first_name,
            'middleName' => $member->middle_name,
            'lastName' => $member->last_name,
            'membershipNumber' => $member->membership_number,
            'uniqueId' => $member->unique_id,
            'gender' => $member->gender,
            'birthDate' => $member->birth_date,
            'nationality' => $member->nationality,
            'emergencyContact' => $member->emergency_contact,
            'emergencyContactName' => $member->emergency_contact_name,
            'emergencyContactPhone' => $member->emergency_contact_phone,
            'joinDate' => $member->join_date,
            'status' => $member->status,
            'isFrozen' => $member->is_frozen,
            'freezeStartDate' => $member->freeze_start_date,
            'freezeEndDate' => $member->freeze_end_date,
            'freezeNotes' => $member->freeze_notes,
            'notes' => $member->notes,
            'height' => $member->height,
            'weight' => $member->weight,
            'fitnessGoal' => $member->fitness_goal,
            'userName' => $user->name,
            'userEmail' => $user->email,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $member = Member::query()->find($id);

        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        $validated = $request->validate([
            'branchId' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'primaryPackageId' => ['nullable', 'integer', 'exists:packages,id'],
            'packageId' => ['nullable', 'integer', 'exists:packages,id'],
            'packageIds' => ['nullable', 'array'],
            'packageIds.*' => ['integer', 'exists:packages,id'],
            'classId' => ['nullable', 'integer', 'exists:classes,id'],
            'classIds' => ['nullable', 'array'],
            'classIds.*' => ['integer', 'exists:classes,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'middleName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($member->user_id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'membershipNumber' => ['nullable', 'string', 'max:100'],
            'uniqueId' => ['nullable', 'string', 'max:100', Rule::unique('members', 'unique_id')->ignore($member->id)],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContact' => ['nullable', 'string', 'max:255'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'joinDate' => ['nullable', 'date'],
            'membershipEndDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'frozen'])],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'height' => ['nullable', 'numeric'],
            'weight' => ['nullable', 'numeric'],
            'fitnessGoal' => ['nullable', 'string'],
        ]);

        $selectedPackageIds = collect($validated['packageIds'] ?? [])
            ->push($validated['primaryPackageId'] ?? null)
            ->push($validated['packageId'] ?? null)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        $selectedClassIds = collect($validated['classIds'] ?? [])
            ->push($validated['classId'] ?? null)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if ($selectedPackageIds->isNotEmpty()) {
            $validated['primaryPackageId'] = $selectedPackageIds->first();
        } elseif (array_key_exists('primaryPackageId', $validated) || array_key_exists('packageId', $validated) || array_key_exists('packageIds', $validated)) {
            $validated['primaryPackageId'] = null;
        }

        $branchId = (int) ($validated['branchId'] ?? $member->branch_id);
        $selectedPackages = $selectedPackageIds->isEmpty()
            ? collect()
            : DB::table('packages')->whereIn('id', $selectedPackageIds)->get()->keyBy('id');

        foreach ($selectedPackageIds as $packageId) {
            $package = $selectedPackages->get($packageId);
            if (!$package || $package->status !== 'active') {
                return response()->json(['message' => 'Selected package is not available'], 422);
            }

            if (!$package->allows_all_branches && $package->branch_id && (int) $package->branch_id !== $branchId) {
                return response()->json(['message' => 'Selected package does not belong to the chosen branch'], 422);
            }
        }

        $mapping = [
            'branchId' => 'branch_id',
            'primaryPackageId' => 'primary_package_id',
            'firstName' => 'first_name',
            'middleName' => 'middle_name',
            'lastName' => 'last_name',
            'membershipNumber' => 'membership_number',
            'uniqueId' => 'unique_id',
            'gender' => 'gender',
            'birthDate' => 'birth_date',
            'nationality' => 'nationality',
            'emergencyContact' => 'emergency_contact',
            'emergencyContactName' => 'emergency_contact_name',
            'emergencyContactPhone' => 'emergency_contact_phone',
            'joinDate' => 'join_date',
            'status' => 'status',
            'isFrozen' => 'is_frozen',
            'freezeStartDate' => 'freeze_start_date',
            'freezeEndDate' => 'freeze_end_date',
            'freezeNotes' => 'freeze_notes',
            'notes' => 'notes',
            'height' => 'height',
            'weight' => 'weight',
            'fitnessGoal' => 'fitness_goal',
        ];

        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }

        if (array_key_exists('isFrozen', $validated)) {
            $payload['status'] = $validated['isFrozen']
                ? 'frozen'
                : (($validated['status'] ?? $member->status) === 'frozen' ? 'active' : ($validated['status'] ?? $member->status));
        }

        DB::transaction(function () use ($member, $payload, $validated, $selectedPackageIds, $selectedClassIds, $selectedPackages) {
            $member->fill($payload)->save();

            $userPayload = [];
            if (array_key_exists('name', $validated)) {
                $userPayload['name'] = $validated['name'];
            } elseif (
                array_key_exists('firstName', $validated) ||
                array_key_exists('middleName', $validated) ||
                array_key_exists('lastName', $validated)
            ) {
                $userPayload['name'] = trim(implode(' ', array_filter([
                    $validated['firstName'] ?? $member->first_name,
                    $validated['middleName'] ?? $member->middle_name,
                    $validated['lastName'] ?? $member->last_name,
                ])));
            }

            if (array_key_exists('email', $validated)) {
                $userPayload['email'] = $validated['email'];
            }

            if (array_key_exists('phone', $validated)) {
                $userPayload['phone'] = $validated['phone'];
            }

            if (!empty($validated['password'])) {
                $userPayload['password'] = Hash::make($validated['password']);
            }

            if ($userPayload !== []) {
                User::query()->where('id', $member->user_id)->update($userPayload);
            }

            $subscription = Subscription::query()
                ->where('member_id', $member->id)
                ->whereIn('status', ['active', 'frozen'])
                ->latest('id')
                ->first();

            $primaryPackage = $validated['primaryPackageId'] ?? null;
            $startDate = $validated['joinDate'] ?? $member->join_date ?? now()->toDateString();
            $freezeStartDate = $validated['freezeStartDate'] ?? $member->freeze_start_date;
            $freezeEndDate = $validated['freezeEndDate'] ?? $member->freeze_end_date;
            $isFrozen = (bool) ($validated['isFrozen'] ?? $member->is_frozen);
            $memberStatus = $payload['status'] ?? $member->status;

            if ($subscription && $primaryPackage !== null) {
                $subscriptionPayload = [];

                $package = $selectedPackages->get($primaryPackage);
                $subscriptionPayload['package_id'] = $primaryPackage;

                if (array_key_exists('joinDate', $validated)) {
                    $subscriptionPayload['start_date'] = $validated['joinDate'];
                }

                if (array_key_exists('membershipEndDate', $validated) && $validated['membershipEndDate'] !== null) {
                    $subscriptionPayload['end_date'] = $validated['membershipEndDate'];
                } elseif ($package) {
                    $durationDays = max(((int) ($package->duration_days ?? 0)) - 1, 0);
                    $subscriptionPayload['end_date'] = now()->parse($startDate)->addDays($durationDays)->toDateString();
                    $subscriptionPayload['remaining_classes'] = $package->total_classes;
                    $subscriptionPayload['remaining_class_credits'] = json_decode($package->selected_class_credits ?? 'null', true);
                    $subscriptionPayload['pt_sessions_total'] = $package->included_pt_sessions ?? 0;
                }

                if (array_key_exists('isFrozen', $validated)) {
                    $subscriptionPayload['is_frozen'] = $validated['isFrozen'];
                    $subscriptionPayload['status'] = $validated['isFrozen'] ? 'frozen' : ($validated['status'] ?? 'active');
                }

                if (array_key_exists('freezeStartDate', $validated)) {
                    $subscriptionPayload['freeze_start_date'] = $validated['freezeStartDate'];
                }

                if (array_key_exists('freezeEndDate', $validated)) {
                    $subscriptionPayload['freeze_end_date'] = $validated['freezeEndDate'];
                }

                if (array_key_exists('isFrozen', $validated) && !$validated['isFrozen']) {
                    $subscriptionPayload['freeze_start_date'] = null;
                    $subscriptionPayload['freeze_end_date'] = null;
                }

                if ($subscriptionPayload !== []) {
                    $subscription->fill($subscriptionPayload)->save();
                }
            } elseif ($primaryPackage !== null) {
                $package = $selectedPackages->get($primaryPackage);
                $durationDays = max(((int) ($package->duration_days ?? 0)) - 1, 0);
                $endDate = $validated['membershipEndDate'] ?? now()->parse($startDate)->addDays($durationDays)->toDateString();

                Subscription::query()->create([
                    'member_id' => $member->id,
                    'package_id' => $primaryPackage,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'remaining_classes' => $package->total_classes,
                    'remaining_class_credits' => json_decode($package->selected_class_credits ?? 'null', true),
                    'pt_sessions_total' => $package->included_pt_sessions ?? 0,
                    'pt_sessions_used' => 0,
                    'is_frozen' => $isFrozen,
                    'freeze_start_date' => $freezeStartDate,
                    'freeze_end_date' => $freezeEndDate,
                    'freeze_days_used' => 0,
                    'status' => $isFrozen ? 'frozen' : ($memberStatus === 'frozen' ? 'active' : $memberStatus),
                ]);
            }

            $extraPackageIds = $selectedPackageIds
                ->filter(fn ($packageId) => (int) $packageId !== (int) ($validated['primaryPackageId'] ?? 0));

            foreach ($extraPackageIds as $packageId) {
                $existingSubscription = Subscription::query()
                    ->where('member_id', $member->id)
                    ->where('package_id', $packageId)
                    ->whereIn('status', ['active', 'frozen'])
                    ->first();

                if ($existingSubscription) {
                    continue;
                }

                $package = $selectedPackages->get($packageId);
                if (!$package) {
                    continue;
                }

                $durationDays = max(((int) ($package->duration_days ?? 0)) - 1, 0);
                $endDate = now()->parse($startDate)->addDays($durationDays)->toDateString();

                Subscription::query()->create([
                    'member_id' => $member->id,
                    'package_id' => $packageId,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'remaining_classes' => $package->total_classes,
                    'remaining_class_credits' => json_decode($package->selected_class_credits ?? 'null', true),
                    'pt_sessions_total' => $package->included_pt_sessions ?? 0,
                    'pt_sessions_used' => 0,
                    'is_frozen' => $isFrozen,
                    'freeze_start_date' => $freezeStartDate,
                    'freeze_end_date' => $freezeEndDate,
                    'freeze_days_used' => 0,
                    'status' => $isFrozen ? 'frozen' : 'active',
                ]);
            }

            foreach ($selectedClassIds as $classId) {
                $existingBooking = DB::table('class_bookings')
                    ->where('member_id', $member->id)
                    ->where('class_id', $classId)
                    ->whereIn('status', ['booked', 'attended'])
                    ->exists();

                if ($existingBooking) {
                    continue;
                }

                DB::table('class_bookings')->insert([
                    'class_id' => $classId,
                    'member_id' => $member->id,
                    'booking_type' => 'extra_payment',
                    'subscription_id' => null,
                    'payment_id' => null,
                    'status' => 'booked',
                    'booked_at' => now(),
                ]);
            }
        });

        return response()->json($member->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $member = Member::query()->find($id);

        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        $member->delete();

        return response()->json([], 204);
    }

    private function memberBaseQuery()
    {
        return DB::table('members');
    }

    private function extractFirstName(string $name): string
    {
        return trim(explode(' ', trim($name), 2)[0] ?? $name);
    }

    private function extractLastName(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name));

        return count($parts) > 1 ? trim((string) end($parts)) : null;
    }

    private function extractMiddleName(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name));

        if (count($parts) <= 2) {
            return null;
        }

        return trim(implode(' ', array_slice($parts, 1, -1)));
    }

    private function generateUniqueId(string $table): string
    {
        $existing = DB::table($table)
            ->where('unique_id', 'like', 'SLR-%')
            ->pluck('unique_id');

        $max = 0;
        foreach ($existing as $value) {
            if (preg_match('/^SLR-(\d+)$/i', (string) $value, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return 'SLR-' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
