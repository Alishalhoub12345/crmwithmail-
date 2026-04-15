<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymOrder;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;

        $query = DB::table('orders')
            ->leftJoin('members', 'orders.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->select([
                'orders.id',
                'orders.member_id as memberId',
                'orders.branch_id as branchId',
                'orders.total_amount as totalAmount',
                'orders.payment_status as paymentStatus',
                'orders.order_status as orderStatus',
                'orders.created_at as createdAt',
                'users.name as memberName',
            ])
            ->orderByDesc('orders.created_at');

        if ($branchId) {
            $query->where('orders.branch_id', $branchId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'totalAmount' => ['required', 'numeric'],
            'paymentStatus' => ['nullable', Rule::in(['pending', 'paid', 'failed'])],
            'orderStatus' => ['nullable', Rule::in(['open', 'shipped', 'closed'])],
            'items' => ['nullable', 'array'],
            'items.*.productId' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required_with:items', 'integer'],
            'items.*.unitPrice' => ['required_with:items', 'numeric'],
            'items.*.totalPrice' => ['required_with:items', 'numeric'],
        ]);

        $order = DB::transaction(function () use ($validated) {
            $order = GymOrder::query()->create([
                'member_id' => $validated['memberId'],
                'branch_id' => $validated['branchId'],
                'total_amount' => $validated['totalAmount'],
                'payment_status' => $validated['paymentStatus'] ?? 'pending',
                'order_status' => $validated['orderStatus'] ?? 'open',
            ]);

            foreach ($validated['items'] ?? [] as $item) {
                OrderItem::query()->create([
                    'order_id' => $order->id,
                    'product_id' => $item['productId'],
                    'qty' => $item['qty'],
                    'unit_price' => $item['unitPrice'],
                    'total_price' => $item['totalPrice'],
                ]);
            }

            return $order;
        });

        return response()->json($order, 201);
    }
}
