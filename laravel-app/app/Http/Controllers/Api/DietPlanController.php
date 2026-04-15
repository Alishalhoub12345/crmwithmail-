<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DietPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DietPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $memberId = $request->query('memberId');
        $query = DietPlan::query()->orderByDesc('created_at');
        if ($memberId) {
            $query->where('member_id', (int) $memberId);
        }
        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'dietitianId' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calories' => ['nullable', 'integer'],
            'protein' => ['nullable', 'numeric'],
            'carbs' => ['nullable', 'numeric'],
            'fat' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
        ]);

        $actor = $request->user();
        $plan = DietPlan::query()->create([
            'member_id' => $validated['memberId'],
            'dietitian_id' => $validated['dietitianId'] ?? $actor->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'calories' => $validated['calories'] ?? null,
            'protein' => $validated['protein'] ?? null,
            'carbs' => $validated['carbs'] ?? null,
            'fats' => $validated['fat'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'start_date' => $validated['startDate'] ?? null,
            'end_date' => $validated['endDate'] ?? null,
        ]);

        return response()->json($plan, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $plan = DietPlan::query()->find($id);
        if (!$plan) {
            return response()->json(['message' => 'Diet plan not found'], 404);
        }

        $validated = $request->validate([
            'memberId' => ['sometimes', 'required', 'integer', 'exists:members,id'],
            'dietitianId' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calories' => ['nullable', 'integer'],
            'protein' => ['nullable', 'numeric'],
            'carbs' => ['nullable', 'numeric'],
            'fat' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
        ]);

        $mapping = [
            'memberId' => 'member_id',
            'dietitianId' => 'dietitian_id',
            'title' => 'title',
            'description' => 'description',
            'calories' => 'calories',
            'protein' => 'protein',
            'carbs' => 'carbs',
            'fat' => 'fats',
            'notes' => 'notes',
            'startDate' => 'start_date',
            'endDate' => 'end_date',
        ];
        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }
        $plan->fill($payload)->save();
        return response()->json($plan->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $plan = DietPlan::query()->find($id);
        if (!$plan) {
            return response()->json(['message' => 'Diet plan not found'], 404);
        }
        $plan->delete();
        return response()->json([], 204);
    }
}
