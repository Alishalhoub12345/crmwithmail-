<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PtSession;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PtSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $memberId = $request->query('memberId');
        $coachId = $request->query('coachId');

        $query = DB::table('pt_sessions')
            ->leftJoin('members', 'pt_sessions.member_id', '=', 'members.id')
            ->leftJoin('users as member_users', 'members.user_id', '=', 'member_users.id')
            ->leftJoin('coaches', 'pt_sessions.coach_id', '=', 'coaches.id')
            ->leftJoin('users as coach_users', 'coaches.user_id', '=', 'coach_users.id')
            ->leftJoin('branches', 'pt_sessions.branch_id', '=', 'branches.id')
            ->leftJoin('subscriptions', 'pt_sessions.subscription_id', '=', 'subscriptions.id')
            ->select([
                'pt_sessions.id',
                'pt_sessions.member_id as memberId',
                'pt_sessions.coach_id as coachId',
                'pt_sessions.branch_id as branchId',
                'pt_sessions.subscription_id as subscriptionId',
                'pt_sessions.session_date as sessionDate',
                'pt_sessions.start_time as startTime',
                'pt_sessions.end_time as endTime',
                'pt_sessions.status',
                'pt_sessions.notes',
                'pt_sessions.cancellation_reason as cancellationReason',
                'pt_sessions.canceled_at as canceledAt',
                'pt_sessions.completed_at as completedAt',
                'member_users.name as memberName',
                'coach_users.name as coachName',
                'branches.name as branchName',
                'subscriptions.pt_sessions_total as ptSessionsTotal',
                'subscriptions.pt_sessions_used as ptSessionsUsed',
                DB::raw('(subscriptions.pt_sessions_total - subscriptions.pt_sessions_used) as ptSessionsRemaining'),
            ])
            ->orderByDesc('pt_sessions.session_date')
            ->orderByDesc('pt_sessions.start_time');

        if ($actor->role !== 'owner') {
            $query->where('pt_sessions.branch_id', $actor->branch_id);
        }

        if ($memberId) {
            $query->where('pt_sessions.member_id', (int) $memberId);
        }

        if ($coachId) {
            $query->where('pt_sessions.coach_id', (int) $coachId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'coachId' => ['required', 'integer', 'exists:coaches,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'subscriptionId' => ['required', 'integer', 'exists:subscriptions,id'],
            'sessionDate' => ['required', 'date'],
            'startTime' => ['required', 'string', 'max:32'],
            'endTime' => ['required', 'string', 'max:32'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'canceled', 'late_canceled', 'no_show'])],
            'notes' => ['nullable', 'string'],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $subscription = $this->validSubscription($validated['subscriptionId'], $validated['memberId'], $validated['sessionDate']);
        if ($subscription instanceof JsonResponse) {
            return $subscription;
        }

        $session = DB::transaction(function () use ($validated, $subscription, $request) {
            $status = $validated['status'] ?? 'scheduled';
            $session = PtSession::query()->create([
                'member_id' => $validated['memberId'],
                'coach_id' => $validated['coachId'],
                'branch_id' => $validated['branchId'],
                'subscription_id' => $validated['subscriptionId'],
                'session_date' => $validated['sessionDate'],
                'start_time' => $validated['startTime'],
                'end_time' => $validated['endTime'],
                'status' => $status,
                'notes' => $validated['notes'] ?? null,
                'cancellation_reason' => $validated['cancellationReason'] ?? null,
                'canceled_at' => in_array($status, ['canceled', 'late_canceled'], true) ? now() : null,
                'completed_at' => $status === 'completed' ? now() : null,
                'created_by' => $request->user()?->id,
            ]);

            $this->applyPtSessionImpact($subscription, null, $status);

            return $session;
        });

        return response()->json($session, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $session = PtSession::query()->find($id);
        if (!$session) {
            return response()->json(['message' => 'PT session not found'], 404);
        }

        $validated = $request->validate([
            'memberId' => ['sometimes', 'required', 'integer', 'exists:members,id'],
            'coachId' => ['sometimes', 'required', 'integer', 'exists:coaches,id'],
            'branchId' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'subscriptionId' => ['sometimes', 'required', 'integer', 'exists:subscriptions,id'],
            'sessionDate' => ['sometimes', 'required', 'date'],
            'startTime' => ['sometimes', 'required', 'string', 'max:32'],
            'endTime' => ['sometimes', 'required', 'string', 'max:32'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'canceled', 'late_canceled', 'no_show'])],
            'notes' => ['nullable', 'string'],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $subscriptionId = $validated['subscriptionId'] ?? $session->subscription_id;
        $memberId = $validated['memberId'] ?? $session->member_id;
        $sessionDate = $validated['sessionDate'] ?? $session->session_date;

        $subscription = $this->validSubscription((int) $subscriptionId, (int) $memberId, (string) $sessionDate);
        if ($subscription instanceof JsonResponse) {
            return $subscription;
        }

        $updated = DB::transaction(function () use ($session, $validated, $subscription) {
            $previousStatus = $session->status;
            $nextStatus = $validated['status'] ?? $session->status;

            $mapping = [
                'memberId' => 'member_id',
                'coachId' => 'coach_id',
                'branchId' => 'branch_id',
                'subscriptionId' => 'subscription_id',
                'sessionDate' => 'session_date',
                'startTime' => 'start_time',
                'endTime' => 'end_time',
                'status' => 'status',
                'notes' => 'notes',
                'cancellationReason' => 'cancellation_reason',
            ];

            $payload = [];
            foreach ($mapping as $input => $column) {
                if (array_key_exists($input, $validated)) {
                    $payload[$column] = $validated[$input];
                }
            }

            if (array_key_exists('status', $validated)) {
                $payload['canceled_at'] = in_array($nextStatus, ['canceled', 'late_canceled'], true) ? now() : null;
                $payload['completed_at'] = $nextStatus === 'completed' ? now() : null;
            }

            $session->fill($payload)->save();
            $this->applyPtSessionImpact($subscription, $previousStatus, $nextStatus);

            return $session->fresh();
        });

        return response()->json($updated);
    }

    private function validSubscription(int $subscriptionId, int $memberId, string $sessionDate): Subscription|JsonResponse
    {
        $subscription = Subscription::query()->find($subscriptionId);
        if (!$subscription || (int) $subscription->member_id !== $memberId) {
            return response()->json(['message' => 'Selected PT subscription is invalid for this member'], 422);
        }

        if (Carbon::parse($sessionDate)->gt(Carbon::parse($subscription->end_date))) {
            return response()->json(['message' => 'Session date is beyond the subscription expiry date'], 422);
        }

        return $subscription;
    }

    private function applyPtSessionImpact(Subscription $subscription, ?string $previousStatus, string $nextStatus): void
    {
        $consumesPrevious = in_array($previousStatus, ['completed', 'late_canceled'], true);
        $consumesNext = in_array($nextStatus, ['completed', 'late_canceled'], true);
        $delta = ($consumesNext ? 1 : 0) - ($consumesPrevious ? 1 : 0);

        if ($delta === 0) {
            return;
        }

        $used = max(0, (int) $subscription->pt_sessions_used + $delta);
        $used = min($used, (int) $subscription->pt_sessions_total);

        $subscription->pt_sessions_used = $used;
        $subscription->status = $subscription->is_frozen ? 'frozen' : $subscription->status;
        $subscription->save();
    }
}
