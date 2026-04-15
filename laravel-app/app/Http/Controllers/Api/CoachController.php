<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coach;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CoachController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = DB::table('coaches')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->select([
                'coaches.id',
                'coaches.user_id as userId',
                'coaches.branch_id as branchId',
                'coaches.specialization',
                'coaches.salary',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'coaches.status',
                'coaches.bio',
                'users.name as userName',
                'users.first_name as firstName',
                'users.last_name as lastName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'users.unique_id as uniqueId',
                'users.gender',
                'users.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, users.birth_date, CURDATE()) as age'),
                'users.nationality',
                'users.emergency_contact_name as emergencyContactName',
                'users.emergency_contact_phone as emergencyContactPhone',
                'users.is_frozen as isFrozen',
                'users.freeze_start_date as freezeStartDate',
                'users.freeze_end_date as freezeEndDate',
                'users.freeze_notes as freezeNotes',
                'branches.name as branchName',
            ])
            ->orderByDesc('coaches.id');

        if ($actor->role !== 'owner') {
            $query->where('coaches.branch_id', $actor->branch_id);
        }

        return response()->json($query->get());
    }

    public function show(int $id): JsonResponse
    {
        $coach = DB::table('coaches')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->select([
                'coaches.id',
                'coaches.user_id as userId',
                'coaches.branch_id as branchId',
                'coaches.specialization',
                'coaches.salary',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'coaches.status',
                'coaches.bio',
                'users.name as userName',
                'users.first_name as firstName',
                'users.last_name as lastName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'users.unique_id as uniqueId',
                'users.gender',
                'users.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, users.birth_date, CURDATE()) as age'),
                'users.nationality',
                'users.emergency_contact_name as emergencyContactName',
                'users.emergency_contact_phone as emergencyContactPhone',
                'users.is_frozen as isFrozen',
                'users.freeze_start_date as freezeStartDate',
                'users.freeze_end_date as freezeEndDate',
                'users.freeze_notes as freezeNotes',
                'branches.name as branchName',
            ])
            ->where('coaches.id', $id)
            ->first();

        if (!$coach) {
            return response()->json(['message' => 'Coach not found'], 404);
        }

        return response()->json($coach);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'uniqueId' => ['nullable', 'string', 'max:100', 'unique:users,unique_id'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'specialization' => ['nullable', 'string', 'max:255'],
            'salary' => ['nullable', 'numeric'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bio' => ['nullable', 'string'],
        ]);

        $coach = DB::transaction(function () use ($validated) {
            $user = User::query()->create([
                'name' => $validated['name'],
                'first_name' => $validated['firstName'] ?? null,
                'last_name' => $validated['lastName'] ?? null,
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password'] ?? 'Coach@2024'),
                'role' => 'coach',
                'branch_id' => $validated['branchId'],
                'unique_id' => $validated['uniqueId'] ?? $this->generateUniqueId(),
                'gender' => $validated['gender'] ?? null,
                'birth_date' => $validated['birthDate'] ?? null,
                'nationality' => $validated['nationality'] ?? null,
                'emergency_contact_name' => $validated['emergencyContactName'] ?? null,
                'emergency_contact_phone' => $validated['emergencyContactPhone'] ?? null,
                'is_frozen' => $validated['isFrozen'] ?? false,
                'freeze_start_date' => $validated['freezeStartDate'] ?? null,
                'freeze_end_date' => $validated['freezeEndDate'] ?? null,
                'freeze_notes' => $validated['freezeNotes'] ?? null,
                'status' => 'active',
            ]);

            return Coach::query()->create([
                'user_id' => $user->id,
                'branch_id' => $validated['branchId'],
                'specialization' => $validated['specialization'] ?? null,
                'salary' => $validated['salary'] ?? null,
                'hire_date' => $validated['startDate'] ?? null,
                'end_date' => $validated['endDate'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'bio' => $validated['bio'] ?? null,
            ]);
        });

        return response()->json([
            'id' => $coach->id,
            'userId' => $coach->user_id,
            'branchId' => $coach->branch_id,
            'specialization' => $coach->specialization,
            'salary' => $coach->salary,
            'startDate' => $coach->hire_date,
            'endDate' => $coach->end_date,
            'status' => $coach->status,
            'bio' => $coach->bio,
            'userName' => $validated['name'],
            'firstName' => $validated['firstName'] ?? null,
            'lastName' => $validated['lastName'] ?? null,
            'userEmail' => $validated['email'],
            'userPhone' => $validated['phone'] ?? null,
            'uniqueId' => $validated['uniqueId'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'birthDate' => $validated['birthDate'] ?? null,
            'nationality' => $validated['nationality'] ?? null,
            'emergencyContactName' => $validated['emergencyContactName'] ?? null,
            'emergencyContactPhone' => $validated['emergencyContactPhone'] ?? null,
            'isFrozen' => $validated['isFrozen'] ?? false,
            'freezeStartDate' => $validated['freezeStartDate'] ?? null,
            'freezeEndDate' => $validated['freezeEndDate'] ?? null,
            'freezeNotes' => $validated['freezeNotes'] ?? null,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $coach = Coach::query()->find($id);

        if (!$coach) {
            return response()->json(['message' => 'Coach not found'], 404);
        }

        $user = User::query()->find($coach->user_id);

        $validated = $request->validate([
            'branchId' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($coach->user_id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'uniqueId' => ['nullable', 'string', 'max:100', Rule::unique('users', 'unique_id')->ignore($coach->user_id)],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'specialization' => ['nullable', 'string', 'max:255'],
            'salary' => ['nullable', 'numeric'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bio' => ['nullable', 'string'],
        ]);

        $mapping = [
            'branchId' => 'branch_id',
            'specialization' => 'specialization',
            'salary' => 'salary',
            'startDate' => 'hire_date',
            'endDate' => 'end_date',
            'status' => 'status',
            'bio' => 'bio',
        ];

        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }

        DB::transaction(function () use ($coach, $user, $payload, $validated) {
            $coach->fill($payload)->save();

            if ($user) {
                $user->fill([
                    'name' => $validated['name'] ?? $user->name,
                    'first_name' => array_key_exists('firstName', $validated) ? $validated['firstName'] : $user->first_name,
                    'last_name' => array_key_exists('lastName', $validated) ? $validated['lastName'] : $user->last_name,
                    'email' => $validated['email'] ?? $user->email,
                    'phone' => $validated['phone'] ?? $user->phone,
                    'branch_id' => array_key_exists('branchId', $validated) ? $validated['branchId'] : $user->branch_id,
                    'unique_id' => array_key_exists('uniqueId', $validated) ? $validated['uniqueId'] : $user->unique_id,
                    'gender' => array_key_exists('gender', $validated) ? $validated['gender'] : $user->gender,
                    'birth_date' => array_key_exists('birthDate', $validated) ? $validated['birthDate'] : $user->birth_date,
                    'nationality' => array_key_exists('nationality', $validated) ? $validated['nationality'] : $user->nationality,
                    'emergency_contact_name' => array_key_exists('emergencyContactName', $validated) ? $validated['emergencyContactName'] : $user->emergency_contact_name,
                    'emergency_contact_phone' => array_key_exists('emergencyContactPhone', $validated) ? $validated['emergencyContactPhone'] : $user->emergency_contact_phone,
                    'is_frozen' => array_key_exists('isFrozen', $validated) ? $validated['isFrozen'] : $user->is_frozen,
                    'freeze_start_date' => array_key_exists('freezeStartDate', $validated) ? $validated['freezeStartDate'] : $user->freeze_start_date,
                    'freeze_end_date' => array_key_exists('freezeEndDate', $validated) ? $validated['freezeEndDate'] : $user->freeze_end_date,
                    'freeze_notes' => array_key_exists('freezeNotes', $validated) ? $validated['freezeNotes'] : $user->freeze_notes,
                    'status' => $validated['status'] ?? $user->status,
                ])->save();
            }
        });

        return response()->json($coach->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $coach = Coach::query()->find($id);

        if (!$coach) {
            return response()->json(['message' => 'Coach not found'], 404);
        }

        $coach->delete();

        return response()->json([], 204);
    }

    private function generateUniqueId(): string
    {
        $existing = DB::table('users')
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
