<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Branch::query()->latest('created_at')->get()
        );
    }

    public function show(int $id): JsonResponse
    {
        $branch = Branch::query()->find($id);

        if (!$branch) {
            return response()->json(['message' => 'Branch not found'], 404);
        }

        return response()->json($branch);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'secondaryPhone' => ['nullable', 'string', 'max:50'],
            'mobile' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $validated['phone'] = $this->normalizePhoneInput($validated['phone'] ?? null);
        $validated['secondary_phone'] = $this->normalizePhoneInput($validated['secondaryPhone'] ?? null);
        $validated['mobile'] = $this->normalizePhoneInput($validated['mobile'] ?? null);

        unset($validated['secondaryPhone']);

        $branch = Branch::query()->create($validated);

        return response()->json($branch, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $branch = Branch::query()->find($id);

        if (!$branch) {
            return response()->json(['message' => 'Branch not found'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'location' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'secondaryPhone' => ['nullable', 'string', 'max:50'],
            'mobile' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        if (array_key_exists('phone', $validated)) {
            $validated['phone'] = $this->normalizePhoneInput($validated['phone']);
        }

        if (array_key_exists('secondaryPhone', $validated)) {
            $validated['secondary_phone'] = $this->normalizePhoneInput($validated['secondaryPhone']);
            unset($validated['secondaryPhone']);
        }

        if (array_key_exists('mobile', $validated)) {
            $validated['mobile'] = $this->normalizePhoneInput($validated['mobile']);
        }

        $branch->fill($validated)->save();

        return response()->json($branch->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $branch = Branch::query()->find($id);

        if (!$branch) {
            return response()->json(['message' => 'Branch not found'], 404);
        }

        $branch->delete();

        return response()->json([], 204);
    }

    private function normalizePhoneInput(?string $value): ?string
    {
        $normalized = trim((string) $value);

        if ($normalized === '' || $normalized === '+961') {
            return null;
        }

        return $normalized;
    }
}
