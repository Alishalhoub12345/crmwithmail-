<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $memberId = $request->query('memberId');
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;

        $query = DB::table('invoices')
            ->leftJoin('members', 'invoices.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('branches', 'invoices.branch_id', '=', 'branches.id')
            ->select([
                'invoices.id',
                'invoices.invoice_number as invoiceNumber',
                'invoices.member_id as memberId',
                'invoices.branch_id as branchId',
                'invoices.subscription_id as subscriptionId',
                'invoices.invoice_type as invoiceType',
                'invoices.status',
                'invoices.issue_date as issueDate',
                'invoices.due_date as dueDate',
                'invoices.subtotal',
                'invoices.discount_amount as discountAmount',
                'invoices.tax_amount as taxAmount',
                'invoices.total_amount as totalAmount',
                'invoices.amount_paid as amountPaid',
                'invoices.balance_due as balanceDue',
                'invoices.notes',
                'users.name as memberName',
                'branches.name as branchName',
            ])
            ->orderByDesc('invoices.created_at');

        if ($branchId) {
            $query->where('invoices.branch_id', $branchId);
        }

        if ($memberId) {
            $query->where('invoices.member_id', (int) $memberId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'subscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'invoiceType' => ['required', Rule::in(['membership', 'personal_training', 'class_extra', 'product', 'other'])],
            'issueDate' => ['nullable', 'date'],
            'dueDate' => ['nullable', 'date'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'discountAmount' => ['nullable', 'numeric', 'min:0'],
            'taxAmount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $subtotal = (float) $validated['subtotal'];
        $discount = (float) ($validated['discountAmount'] ?? 0);
        $tax = (float) ($validated['taxAmount'] ?? 0);
        $total = max($subtotal - $discount + $tax, 0);

        $invoice = Invoice::query()->create([
            'invoice_number' => $this->nextInvoiceNumber(),
            'member_id' => $validated['memberId'],
            'branch_id' => $validated['branchId'],
            'subscription_id' => $validated['subscriptionId'] ?? null,
            'invoice_type' => $validated['invoiceType'],
            'status' => 'issued',
            'issue_date' => $validated['issueDate'] ?? now()->toDateString(),
            'due_date' => $validated['dueDate'] ?? null,
            'subtotal' => $subtotal,
            'discount_amount' => $discount,
            'tax_amount' => $tax,
            'total_amount' => $total,
            'amount_paid' => 0,
            'balance_due' => $total,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json($invoice, 201);
    }

    private function nextInvoiceNumber(): string
    {
        $latestId = (int) (Invoice::query()->max('id') ?? 0) + 1;

        return 'INV-' . now()->format('Y') . '-' . str_pad((string) $latestId, 5, '0', STR_PAD_LEFT);
    }
}
