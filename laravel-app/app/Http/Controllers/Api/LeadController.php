<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = DB::table('leads')
            ->leftJoin('branches', 'leads.branch_id', '=', 'branches.id')
            ->leftJoin('users', 'leads.assigned_to', '=', 'users.id')
            ->select([
                'leads.id',
                'leads.branch_id as branchId',
                'leads.name',
                'leads.first_name as firstName',
                'leads.last_name as lastName',
                'leads.phone',
                'leads.email',
                'leads.unique_id as uniqueId',
                'leads.gender',
                'leads.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, leads.birth_date, CURDATE()) as age'),
                'leads.nationality',
                'leads.emergency_contact_name as emergencyContactName',
                'leads.emergency_contact_phone as emergencyContactPhone',
                'leads.is_frozen as isFrozen',
                'leads.freeze_start_date as freezeStartDate',
                'leads.freeze_end_date as freezeEndDate',
                'leads.freeze_notes as freezeNotes',
                'leads.source',
                'leads.status',
                'leads.assigned_to as assignedTo',
                'leads.notes',
                'leads.created_at as createdAt',
                'branches.name as branchName',
                'users.name as assignedName',
            ])
            ->orderByDesc('leads.created_at');

        if ($actor->role !== 'owner') {
            $query->where('leads.branch_id', $actor->branch_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'uniqueId' => ['nullable', 'string', 'max:100'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'source' => ['nullable', Rule::in(['walk_in', 'social', 'website', 'referral', 'other'])],
            'status' => ['nullable', Rule::in(['new', 'contacted', 'converted', 'lost'])],
            'assignedTo' => ['nullable', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $lead = Lead::query()->create([
            'branch_id' => $validated['branchId'],
            'name' => $validated['name'],
            'first_name' => $validated['firstName'] ?? null,
            'last_name' => $validated['lastName'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
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
            'source' => $validated['source'] ?? 'other',
            'status' => $validated['status'] ?? 'new',
            'assigned_to' => $validated['assignedTo'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json($lead, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $lead = Lead::query()->find($id);
        if (!$lead) {
            return response()->json(['message' => 'Lead not found'], 404);
        }

        $validated = $request->validate([
            'branchId' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'uniqueId' => ['nullable', 'string', 'max:100'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'isFrozen' => ['nullable', 'boolean'],
            'freezeStartDate' => ['nullable', 'date'],
            'freezeEndDate' => ['nullable', 'date'],
            'freezeNotes' => ['nullable', 'string'],
            'source' => ['nullable', Rule::in(['walk_in', 'social', 'website', 'referral', 'other'])],
            'status' => ['nullable', Rule::in(['new', 'contacted', 'converted', 'lost'])],
            'assignedTo' => ['nullable', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $mapping = [
            'branchId' => 'branch_id',
            'name' => 'name',
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'phone' => 'phone',
            'email' => 'email',
            'uniqueId' => 'unique_id',
            'gender' => 'gender',
            'birthDate' => 'birth_date',
            'nationality' => 'nationality',
            'emergencyContactName' => 'emergency_contact_name',
            'emergencyContactPhone' => 'emergency_contact_phone',
            'isFrozen' => 'is_frozen',
            'freezeStartDate' => 'freeze_start_date',
            'freezeEndDate' => 'freeze_end_date',
            'freezeNotes' => 'freeze_notes',
            'source' => 'source',
            'status' => 'status',
            'assignedTo' => 'assigned_to',
            'notes' => 'notes',
        ];
        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }
        $lead->fill($payload)->save();
        return response()->json($lead->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $lead = Lead::query()->find($id);
        if (!$lead) {
            return response()->json(['message' => 'Lead not found'], 404);
        }
        $lead->delete();
        return response()->json([], 204);
    }

    private function generateUniqueId(): string
    {
        $existing = DB::table('leads')
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
