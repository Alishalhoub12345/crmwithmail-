<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $query = User::query()->latest('created_at');

        if ($actor->role !== 'owner') {
            $query->where('branch_id', $actor->branch_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'role' => ['required', Rule::in(['owner', 'admin', 'coach', 'member', 'dietitian'])],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'phone' => ['nullable', 'string', 'max:50'],
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
            'status' => ['nullable', Rule::in(['active', 'suspended', 'inactive'])],
        ]);

        $password = $validated['password'] ?? 'GymCRM@2024';

        $user = User::query()->create([
            'name' => $validated['name'],
            'first_name' => $validated['firstName'] ?? null,
            'last_name' => $validated['lastName'] ?? null,
            'email' => $validated['email'],
            'password' => Hash::make($password),
            'role' => $validated['role'],
            'branch_id' => $validated['branchId'] ?? null,
            'phone' => $validated['phone'] ?? null,
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
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'firstName' => $user->first_name,
            'lastName' => $user->last_name,
            'email' => $user->email,
            'role' => $user->role,
            'branchId' => $user->branch_id,
            'phone' => $user->phone,
            'uniqueId' => $user->unique_id,
            'gender' => $user->gender,
            'birthDate' => $user->birth_date,
            'nationality' => $user->nationality,
            'emergencyContactName' => $user->emergency_contact_name,
            'emergencyContactPhone' => $user->emergency_contact_phone,
            'isFrozen' => $user->is_frozen,
            'freezeStartDate' => $user->freeze_start_date,
            'freezeEndDate' => $user->freeze_end_date,
            'freezeNotes' => $user->freeze_notes,
            'status' => $user->status,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::query()->find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'role' => ['sometimes', Rule::in(['owner', 'admin', 'coach', 'member', 'dietitian'])],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'phone' => ['nullable', 'string', 'max:50'],
            'uniqueId' => ['nullable', 'string', 'max:100', Rule::unique('users', 'unique_id')->ignore($user->id)],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'suspended', 'inactive'])],
        ]);

        $payload = [
            'name' => $validated['name'] ?? $user->name,
            'first_name' => array_key_exists('firstName', $validated) ? $validated['firstName'] : $user->first_name,
            'last_name' => array_key_exists('lastName', $validated) ? $validated['lastName'] : $user->last_name,
            'email' => $validated['email'] ?? $user->email,
            'role' => $validated['role'] ?? $user->role,
            'branch_id' => array_key_exists('branchId', $validated) ? $validated['branchId'] : $user->branch_id,
            'phone' => $validated['phone'] ?? $user->phone,
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
        ];

        if (!empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $user->fill($payload)->save();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'firstName' => $user->first_name,
            'lastName' => $user->last_name,
            'email' => $user->email,
            'role' => $user->role,
            'branchId' => $user->branch_id,
            'phone' => $user->phone,
            'uniqueId' => $user->unique_id,
            'gender' => $user->gender,
            'birthDate' => $user->birth_date,
            'nationality' => $user->nationality,
            'emergencyContactName' => $user->emergency_contact_name,
            'emergencyContactPhone' => $user->emergency_contact_phone,
            'isFrozen' => $user->is_frozen,
            'freezeStartDate' => $user->freeze_start_date,
            'freezeEndDate' => $user->freeze_end_date,
            'freezeNotes' => $user->freeze_notes,
            'status' => $user->status,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = User::query()->find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->delete();

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
