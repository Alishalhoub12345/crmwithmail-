<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeadTaskController extends Controller
{
    public function index(int $id): JsonResponse
    {
        return response()->json(
            LeadTask::query()->where('lead_id', $id)->orderByDesc('created_at')->get()
        );
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'assignedTo' => ['nullable', 'integer', 'exists:users,id'],
            'dueDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['open', 'done', 'canceled'])],
            'note' => ['nullable', 'string'],
        ]);

        $task = LeadTask::query()->create([
            'lead_id' => $id,
            'assigned_to' => $validated['assignedTo'] ?? null,
            'due_date' => $validated['dueDate'] ?? null,
            'status' => $validated['status'] ?? 'open',
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json($task, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $task = LeadTask::query()->find($id);
        if (!$task) {
            return response()->json(['message' => 'Lead task not found'], 404);
        }

        $validated = $request->validate([
            'assignedTo' => ['nullable', 'integer', 'exists:users,id'],
            'dueDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['open', 'done', 'canceled'])],
            'note' => ['nullable', 'string'],
        ]);

        $mapping = [
            'assignedTo' => 'assigned_to',
            'dueDate' => 'due_date',
            'status' => 'status',
            'note' => 'note',
        ];
        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }
        $task->fill($payload)->save();
        return response()->json($task->fresh());
    }
}
