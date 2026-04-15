<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = Product::query()->orderByDesc('id');

        if ($actor->role !== 'owner') {
            $query->where(function ($inner) use ($actor) {
                $inner->where('branch_id', $actor->branch_id)->orWhereNull('branch_id');
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
            'stockQty' => ['nullable', 'integer'],
            'imageUrl' => ['nullable', 'string', 'max:1024'],
            'category' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $product = Product::query()->create([
            'branch_id' => $validated['branchId'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'stock_qty' => $validated['stockQty'] ?? 0,
            'image_url' => $validated['imageUrl'] ?? null,
            'category' => $validated['category'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json($product, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::query()->find($id);
        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $validated = $request->validate([
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric'],
            'stockQty' => ['nullable', 'integer'],
            'imageUrl' => ['nullable', 'string', 'max:1024'],
            'category' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $mapping = [
            'branchId' => 'branch_id',
            'name' => 'name',
            'description' => 'description',
            'price' => 'price',
            'stockQty' => 'stock_qty',
            'imageUrl' => 'image_url',
            'category' => 'category',
            'status' => 'status',
        ];
        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }
        $product->fill($payload)->save();
        return response()->json($product->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $product = Product::query()->find($id);
        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }
        $product->delete();
        return response()->json([], 204);
    }
}
