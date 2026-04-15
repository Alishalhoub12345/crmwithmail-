<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $memberId = $request->query('memberId');
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;

        $query = DB::table('payments')
            ->leftJoin('members', 'payments.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('branches', 'payments.branch_id', '=', 'branches.id')
            ->leftJoin('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->select([
                'payments.id',
                'payments.member_id as memberId',
                'payments.branch_id as branchId',
                'payments.invoice_id as invoiceId',
                'payments.subscription_id as subscriptionId',
                'payments.class_booking_id as classBookingId',
                'payments.amount',
                'payments.payment_type as paymentType',
                'payments.payment_method as paymentMethod',
                'payments.status',
                'payments.transaction_ref as transactionRef',
                'payments.notes',
                'payments.paid_at as paidAt',
                'invoices.invoice_number as invoiceNumber',
                'invoices.balance_due as invoiceBalanceDue',
                'users.name as memberName',
                'branches.name as branchName',
            ])
            ->orderByDesc('payments.paid_at');

        if ($branchId && $memberId) {
            $query->where('payments.branch_id', $branchId)->where('payments.member_id', (int) $memberId);
        } elseif ($branchId) {
            $query->where('payments.branch_id', $branchId);
        } elseif ($memberId) {
            $query->where('payments.member_id', (int) $memberId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'invoiceId' => ['nullable', 'integer', 'exists:invoices,id'],
            'subscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'classBookingId' => ['nullable', 'integer', 'exists:class_bookings,id'],
            'amount' => ['required', 'numeric'],
            'paymentType' => ['required', Rule::in(['package_purchase', 'class_extra', 'product_purchase', 'other'])],
            'paymentMethod' => ['required', Rule::in(['cash', 'card', 'online'])],
            'status' => ['nullable', Rule::in(['pending', 'paid', 'failed', 'refunded'])],
            'transactionRef' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $payment = DB::transaction(function () use ($validated) {
            $payment = Payment::query()->create([
                'member_id' => $validated['memberId'],
                'branch_id' => $validated['branchId'],
                'invoice_id' => $validated['invoiceId'] ?? null,
                'subscription_id' => $validated['subscriptionId'] ?? null,
                'class_booking_id' => $validated['classBookingId'] ?? null,
                'amount' => $validated['amount'],
                'payment_type' => $validated['paymentType'],
                'payment_method' => $validated['paymentMethod'],
                'status' => $validated['status'] ?? 'paid',
                'transaction_ref' => $validated['transactionRef'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            if (!empty($validated['invoiceId']) && ($validated['status'] ?? 'paid') === 'paid') {
                /** @var Invoice|null $invoice */
                $invoice = Invoice::query()->find($validated['invoiceId']);
                if ($invoice) {
                    $invoice->amount_paid = (float) $invoice->amount_paid + (float) $validated['amount'];
                    $invoice->balance_due = max((float) $invoice->total_amount - (float) $invoice->amount_paid, 0);
                    $invoice->status = $invoice->balance_due <= 0 ? 'paid' : 'partial';
                    $invoice->save();
                }
            }

            return $payment;
        });

        return response()->json($payment, 201);
    }
}
