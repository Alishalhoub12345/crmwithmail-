<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PtSession;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PtSessionLifecycle;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PtSessionController extends Controller
{
    private const STATUSES = ['pending', 'scheduled', 'completed', 'canceled', 'late_canceled', 'no_show'];
    private const CREDIT_CONSUMING_STATUSES = ['completed', 'late_canceled', 'no_show'];
    private const BUSY_STATUSES = ['pending', 'scheduled'];

    public function __construct(private readonly PtSessionLifecycle $ptSessionLifecycle)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->ptSessionLifecycle->syncAutoCompletedSessions();

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
            ->leftJoin('members as member_credit_source', 'pt_sessions.member_id', '=', 'member_credit_source.id')
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
                DB::raw('member_credit_source.manual_pt_credits_total as manualPtCreditsTotal'),
                DB::raw('member_credit_source.manual_pt_credits_used as manualPtCreditsUsed'),
                DB::raw('CASE WHEN pt_sessions.subscription_id IS NULL THEN (member_credit_source.manual_pt_credits_total - member_credit_source.manual_pt_credits_used) ELSE (subscriptions.pt_sessions_total - subscriptions.pt_sessions_used) END as ptSessionsRemaining'),
            ])
            ->orderByDesc('pt_sessions.session_date')
            ->orderByDesc('pt_sessions.start_time');

        if ($actor->role === 'member') {
            $member = $this->memberForActor($actor);
            $query->where('pt_sessions.member_id', $member?->id ?? 0);
        } elseif ($actor->role === 'coach') {
            $query->where('pt_sessions.coach_id', $this->coachIdForActor($actor) ?? 0);
        } elseif ($actor->role !== 'owner') {
            $visibleBranchIds = $this->visibleBranchIdsForActor($actor);
            $query->whereIn('pt_sessions.branch_id', $visibleBranchIds);
        }

        if ($memberId) {
            $query->where('pt_sessions.member_id', (int) $memberId);
        }

        if ($coachId) {
            $query->where('pt_sessions.coach_id', (int) $coachId);
        }

        $sessions = $query->get();

        if ($actor->role === 'coach') {
            $sessions->transform(function ($session) {
                unset(
                    $session->ptSessionsTotal,
                    $session->ptSessionsUsed,
                    $session->manualPtCreditsTotal,
                    $session->manualPtCreditsUsed,
                    $session->ptSessionsRemaining
                );

                return $session;
            });
        }

        return response()->json($sessions);
    }

    public function availableCoaches(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'sessionDate' => ['required', 'date'],
            'startTime' => ['required', 'string', 'max:32'],
            'endTime' => ['required', 'string', 'max:32'],
        ]);

        $timeError = $this->validateTimeWindow($validated['startTime'], $validated['endTime']);
        if ($timeError) {
            return $timeError;
        }

        $actor = $request->user();
        $branchId = (int) $validated['branchId'];

        if (!$this->actorCanUseBranch($actor, $branchId)) {
            return response()->json(['message' => 'Selected branch is not available for this account'], 403);
        }

        $coaches = $this->availableCoachesQuery(
            $branchId,
            $validated['sessionDate'],
            $validated['startTime'],
            $validated['endTime']
        )
            ->get()
            ->map(fn ($coach) => $this->transformAvailableCoach($coach))
            ->values();

        return response()->json($coaches);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'coachId' => ['required', 'integer', 'exists:coaches,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'subscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'sessionDate' => ['required', 'date'],
            'startTime' => ['required', 'string', 'max:32'],
            'endTime' => ['required', 'string', 'max:32'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'notes' => ['nullable', 'string'],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $timeError = $this->validateTimeWindow($validated['startTime'], $validated['endTime']);
        if ($timeError) {
            return $timeError;
        }

        $actor = $request->user();
        if ($actor->role === 'coach') {
            return response()->json(['message' => 'Personal trainers can only approve or reject member requests'], 403);
        }

        if ($actor->role === 'member') {
            $member = $this->memberForActor($actor);
            if (!$member) {
                return response()->json(['message' => 'Member profile not found'], 403);
            }

            $validated['memberId'] = (int) $member->id;
            $validated['status'] = 'pending';
        }

        $validationError = $this->validateSessionOwnershipAndAvailability($actor, $validated);
        if ($validationError) {
            return $validationError;
        }

        $creditSource = $this->resolveCreditSource($validated['subscriptionId'] ?? null, $validated['memberId'], $validated['sessionDate']);
        if ($creditSource instanceof JsonResponse) {
            return $creditSource;
        }

        $status = $validated['status'] ?? 'scheduled';
        $creditError = $this->ensureCreditAvailableForRequest($creditSource);
        if ($creditError) {
            return $creditError;
        }

        $impactError = $this->ensureCreditAvailableForImpact($creditSource, null, $status);
        if ($impactError) {
            return $impactError;
        }

        $session = DB::transaction(function () use ($validated, $request, $status) {
            $session = PtSession::query()->create([
                'member_id' => $validated['memberId'],
                'coach_id' => $validated['coachId'],
                'branch_id' => $validated['branchId'],
                'subscription_id' => $validated['subscriptionId'] ?? null,
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

            $this->ptSessionLifecycle->reconcileCreditUsageForSession($session);

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
            'subscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'sessionDate' => ['sometimes', 'required', 'date'],
            'startTime' => ['sometimes', 'required', 'string', 'max:32'],
            'endTime' => ['sometimes', 'required', 'string', 'max:32'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'notes' => ['nullable', 'string'],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $actor = $request->user();
        $permissionError = $this->validateUpdatePermission($actor, $session, $validated);
        if ($permissionError) {
            return $permissionError;
        }

        $nextPayload = [
            'memberId' => $validated['memberId'] ?? $session->member_id,
            'coachId' => $validated['coachId'] ?? $session->coach_id,
            'branchId' => $validated['branchId'] ?? $session->branch_id,
            'subscriptionId' => array_key_exists('subscriptionId', $validated) ? $validated['subscriptionId'] : $session->subscription_id,
            'sessionDate' => $validated['sessionDate'] ?? $session->session_date,
            'startTime' => $validated['startTime'] ?? $session->start_time,
            'endTime' => $validated['endTime'] ?? $session->end_time,
            'status' => $validated['status'] ?? $session->status,
        ];

        $timeError = $this->validateTimeWindow((string) $nextPayload['startTime'], (string) $nextPayload['endTime']);
        if ($timeError) {
            return $timeError;
        }

        $statusError = $this->validateStatusTransition($session, (string) $nextPayload['status']);
        if ($statusError) {
            return $statusError;
        }

        $validationError = $this->validateSessionOwnershipAndAvailability($actor, $nextPayload, $session->id);
        if ($validationError) {
            return $validationError;
        }

        $creditSource = $this->resolveCreditSource(
            $nextPayload['subscriptionId'] ? (int) $nextPayload['subscriptionId'] : null,
            (int) $nextPayload['memberId'],
            (string) $nextPayload['sessionDate']
        );
        if ($creditSource instanceof JsonResponse) {
            return $creditSource;
        }

        $impactError = $this->ensureCreditAvailableForImpact($creditSource, $session->status, (string) $nextPayload['status']);
        if ($impactError) {
            return $impactError;
        }

        $updated = DB::transaction(function () use ($session, $validated, $nextPayload) {
            $previousSubscriptionId = $session->subscription_id ? (int) $session->subscription_id : null;
            $previousMemberId = (int) $session->member_id;
            $nextStatus = (string) $nextPayload['status'];

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
            $freshSession = $session->fresh();
            $this->ptSessionLifecycle->reconcileCreditUsage($previousSubscriptionId, $previousMemberId);
            $this->ptSessionLifecycle->reconcileCreditUsageForSession($freshSession);

            return $freshSession;
        });

        return response()->json($updated);
    }

    private function validateSessionOwnershipAndAvailability(User $actor, array $payload, ?int $ignoreSessionId = null): ?JsonResponse
    {
        $memberId = (int) $payload['memberId'];
        $coachId = (int) $payload['coachId'];
        $branchId = (int) $payload['branchId'];
        $sessionDate = (string) $payload['sessionDate'];
        $startTime = (string) $payload['startTime'];
        $endTime = (string) $payload['endTime'];
        $status = (string) ($payload['status'] ?? 'scheduled');

        if (!$this->actorCanUseBranch($actor, $branchId)) {
            return response()->json(['message' => 'Selected branch is not available for this account'], 403);
        }

        if (!$this->memberCanUseBranch($memberId, $branchId, $payload['subscriptionId'] ?? null)) {
            return response()->json(['message' => 'Member does not have access to the selected branch'], 422);
        }

        if (!$this->coachCanWorkBranch($coachId, $branchId)) {
            return response()->json(['message' => 'Selected trainer does not work in this branch'], 422);
        }

        if (in_array($status, self::BUSY_STATUSES, true) && !$this->coachIsAvailable($coachId, $branchId, $sessionDate, $startTime, $endTime, $ignoreSessionId)) {
            return response()->json(['message' => 'Selected trainer is not available at this time'], 422);
        }

        return null;
    }

    private function validateUpdatePermission(User $actor, PtSession $session, array $validated): ?JsonResponse
    {
        $nextStatus = $validated['status'] ?? $session->status;

        if ($actor->role === 'member') {
            $member = $this->memberForActor($actor);
            if (!$member || (int) $session->member_id !== (int) $member->id) {
                return response()->json(['message' => 'PT session not found'], 404);
            }

            $lockedFields = ['memberId', 'coachId', 'branchId', 'subscriptionId', 'sessionDate', 'startTime', 'endTime'];
            foreach ($lockedFields as $field) {
                if (array_key_exists($field, $validated)) {
                    return response()->json(['message' => 'Members can only cancel their own PT requests'], 403);
                }
            }

            if ($nextStatus !== 'canceled') {
                return response()->json(['message' => 'Members can only cancel PT requests'], 403);
            }

            if (!in_array($session->status, ['pending', 'scheduled'], true)) {
                return response()->json(['message' => 'This PT session cannot be canceled'], 422);
            }

            if ($session->status === 'scheduled' && !$this->canCancelBeforeCutoff($session)) {
                return response()->json(['message' => 'Scheduled PT sessions can only be canceled more than 6 hours before start time'], 422);
            }
        }

        if ($actor->role === 'coach') {
            $actorCoachId = $this->coachIdForActor($actor);
            if (!$actorCoachId || (int) $session->coach_id !== (int) $actorCoachId) {
                return response()->json(['message' => 'PT session not found'], 404);
            }

            $lockedFields = ['memberId', 'coachId', 'branchId', 'subscriptionId', 'sessionDate', 'startTime', 'endTime'];
            foreach ($lockedFields as $field) {
                if (array_key_exists($field, $validated)) {
                    return response()->json(['message' => 'Personal trainers can only update request status'], 403);
                }
            }

            if ($session->status === 'pending' && !in_array($nextStatus, ['scheduled', 'canceled'], true)) {
                return response()->json(['message' => 'Pending requests can only be approved or rejected'], 422);
            }

            if ($session->status === 'scheduled' && $nextStatus === 'canceled') {
                return response()->json(['message' => 'Scheduled sessions can only be canceled by the member before the 6-hour cutoff'], 422);
            }
        }

        return null;
    }

    private function validateStatusTransition(PtSession $session, string $nextStatus): ?JsonResponse
    {
        if ($session->status === 'scheduled' && $nextStatus === 'canceled' && !$this->canCancelBeforeCutoff($session)) {
            return response()->json(['message' => 'Scheduled PT sessions cannot be canceled inside the 6-hour cutoff'], 422);
        }

        if ($session->status === 'pending' && $nextStatus === 'completed') {
            return response()->json(['message' => 'A pending PT request must be approved before it can be completed'], 422);
        }

        return null;
    }

    private function validateTimeWindow(string $startTime, string $endTime): ?JsonResponse
    {
        if ($startTime >= $endTime) {
            return response()->json(['message' => 'End time must be after start time'], 422);
        }

        return null;
    }

    private function resolveCreditSource(?int $subscriptionId, int $memberId, string $sessionDate): Subscription|array|JsonResponse
    {
        if ($subscriptionId === null) {
            $member = DB::table('members')
                ->select(['id', 'manual_pt_credits_total', 'manual_pt_credits_used'])
                ->where('id', $memberId)
                ->first();

            if (!$member) {
                return response()->json(['message' => 'Member not found'], 422);
            }

            return ['type' => 'member', 'memberId' => $memberId];
        }

        $subscription = Subscription::query()->find($subscriptionId);
        if (!$subscription || (int) $subscription->member_id !== $memberId) {
            return response()->json(['message' => 'Selected PT subscription is invalid for this member'], 422);
        }

        if (!in_array($subscription->status, ['active', 'frozen'], true)) {
            return response()->json(['message' => 'Selected PT subscription is not active'], 422);
        }

        if (Carbon::parse($sessionDate)->lt(Carbon::parse($subscription->start_date))) {
            return response()->json(['message' => 'Session date is before the subscription start date'], 422);
        }

        if (Carbon::parse($sessionDate)->gt(Carbon::parse($subscription->end_date))) {
            return response()->json(['message' => 'Session date is beyond the subscription expiry date'], 422);
        }

        return $subscription;
    }

    private function ensureCreditAvailableForRequest(Subscription|array $creditSource): ?JsonResponse
    {
        if ($this->remainingCredits($creditSource) <= 0) {
            return response()->json(['message' => 'Member has no PT credits available'], 422);
        }

        return null;
    }

    private function ensureCreditAvailableForImpact(Subscription|array $creditSource, ?string $previousStatus, string $nextStatus): ?JsonResponse
    {
        $consumesPrevious = in_array($previousStatus, self::CREDIT_CONSUMING_STATUSES, true);
        $consumesNext = in_array($nextStatus, self::CREDIT_CONSUMING_STATUSES, true);

        if (!$consumesPrevious && $consumesNext && $this->remainingCredits($creditSource) <= 0) {
            return response()->json(['message' => 'Member has no PT credits available'], 422);
        }

        return null;
    }

    private function remainingCredits(Subscription|array $creditSource): int
    {
        if (is_array($creditSource) && ($creditSource['type'] ?? null) === 'member') {
            $member = DB::table('members')
                ->select(['manual_pt_credits_total', 'manual_pt_credits_used'])
                ->where('id', $creditSource['memberId'])
                ->first();

            if (!$member) {
                return 0;
            }

            $used = DB::table('pt_sessions')
                ->where('member_id', (int) $creditSource['memberId'])
                ->whereNull('subscription_id')
                ->whereIn('status', self::CREDIT_CONSUMING_STATUSES)
                ->count();

            return max(0, (int) $member->manual_pt_credits_total - (int) $used);
        }

        $used = DB::table('pt_sessions')
            ->where('subscription_id', $creditSource->id)
            ->whereIn('status', self::CREDIT_CONSUMING_STATUSES)
            ->count();

        return max(0, (int) $creditSource->pt_sessions_total - (int) $used);
    }

    private function coachIsAvailable(int $coachId, int $branchId, string $sessionDate, string $startTime, string $endTime, ?int $ignoreSessionId = null): bool
    {
        $classConflict = DB::table('classes')
            ->where('coach_id', $coachId)
            ->where('class_date', $sessionDate)
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->whereNotIn('status', ['inactive', 'canceled'])
            ->exists();

        if ($classConflict) {
            return false;
        }

        $sessionConflict = DB::table('pt_sessions')
            ->where('coach_id', $coachId)
            ->where('session_date', $sessionDate)
            ->whereIn('status', self::BUSY_STATUSES)
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->when($ignoreSessionId, fn ($query) => $query->where('id', '!=', $ignoreSessionId))
            ->exists();

        return !$sessionConflict && $this->coachCanWorkBranch($coachId, $branchId);
    }

    private function availableCoachesQuery(int $branchId, string $sessionDate, string $startTime, string $endTime)
    {
        return DB::table('coaches')
            ->join('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->where('coaches.status', 'active')
            ->where('users.status', 'active')
            ->where(function ($roleScope) {
                $roleScope->where('coaches.role_title', 'Personal Trainer')
                    ->orWhere('coaches.specialization', 'Personal Trainer');
            })
            ->where(function ($branchScope) use ($branchId) {
                $branchScope->where('coaches.branch_id', $branchId)
                    ->orWhereExists(function ($exists) use ($branchId) {
                        $exists->select(DB::raw(1))
                            ->from('coach_branch_access as cba')
                            ->whereColumn('cba.coach_id', 'coaches.id')
                            ->where('cba.branch_id', $branchId);
                    });
            })
            ->whereNotExists(function ($exists) use ($sessionDate, $startTime, $endTime) {
                $exists->select(DB::raw(1))
                    ->from('classes')
                    ->whereColumn('classes.coach_id', 'coaches.id')
                    ->where('classes.class_date', $sessionDate)
                    ->where('classes.start_time', '<', $endTime)
                    ->where('classes.end_time', '>', $startTime)
                    ->whereNotIn('classes.status', ['inactive', 'canceled']);
            })
            ->whereNotExists(function ($exists) use ($sessionDate, $startTime, $endTime) {
                $exists->select(DB::raw(1))
                    ->from('pt_sessions')
                    ->whereColumn('pt_sessions.coach_id', 'coaches.id')
                    ->where('pt_sessions.session_date', $sessionDate)
                    ->whereIn('pt_sessions.status', self::BUSY_STATUSES)
                    ->where('pt_sessions.start_time', '<', $endTime)
                    ->where('pt_sessions.end_time', '>', $startTime);
            })
            ->select([
                'coaches.id',
                'coaches.user_id as userId',
                'coaches.branch_id as branchId',
                'coaches.role_title as roleTitle',
                'coaches.specialization',
                'coaches.commission_rate as commissionRate',
                'users.name as userName',
                'users.email as userEmail',
                'branches.name as branchName',
                DB::raw("(select GROUP_CONCAT(DISTINCT cba.branch_id order by cba.branch_id separator ',') from coach_branch_access cba where cba.coach_id = coaches.id) as branchIdsRaw"),
                DB::raw("(select GROUP_CONCAT(DISTINCT b2.name order by b2.name separator ', ') from coach_branch_access cba join branches b2 on cba.branch_id = b2.id where cba.coach_id = coaches.id) as branchNamesRaw"),
            ])
            ->orderBy('users.name');
    }

    private function transformAvailableCoach(object $coach): array
    {
        $branchIds = collect(explode(',', (string) ($coach->branchIdsRaw ?? '')))
            ->filter(fn ($value) => $value !== '')
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();

        return [
            'id' => (int) $coach->id,
            'userId' => (int) $coach->userId,
            'branchId' => $coach->branchId ? (int) $coach->branchId : null,
            'branchIds' => $branchIds !== [] ? $branchIds : array_values(array_filter([(int) ($coach->branchId ?? 0)])),
            'branchName' => $coach->branchNamesRaw ?: $coach->branchName,
            'roleTitle' => $coach->roleTitle ?: $coach->specialization,
            'specialization' => $coach->specialization,
            'commissionRate' => $coach->commissionRate,
            'userName' => $coach->userName,
            'userEmail' => $coach->userEmail,
        ];
    }

    private function memberForActor(User $actor): ?object
    {
        return DB::table('members')
            ->where('user_id', $actor->id)
            ->select(['id', 'branch_id'])
            ->first();
    }

    private function coachIdForActor(User $actor): ?int
    {
        $coach = DB::table('coaches')
            ->where('user_id', $actor->id)
            ->select(['id'])
            ->first();

        return $coach ? (int) $coach->id : null;
    }

    private function actorCanUseBranch(User $actor, int $branchId): bool
    {
        if ($actor->role === 'owner') {
            return true;
        }

        return in_array($branchId, $this->visibleBranchIdsForActor($actor), true);
    }

    private function memberCanUseBranch(int $memberId, int $branchId, mixed $subscriptionId = null): bool
    {
        $hasMemberAccess = DB::table('members')
            ->where('id', $memberId)
            ->where(function ($branchScope) use ($branchId) {
                $branchScope->where('branch_id', $branchId)
                    ->orWhereExists(function ($exists) use ($branchId) {
                        $exists->select(DB::raw(1))
                            ->from('member_branch_access as mba')
                            ->whereColumn('mba.member_id', 'members.id')
                            ->where('mba.branch_id', $branchId);
                    });
            })
            ->exists();

        if ($hasMemberAccess) {
            return true;
        }

        if (!$subscriptionId) {
            return false;
        }

        return DB::table('subscriptions')
            ->join('packages', 'subscriptions.package_id', '=', 'packages.id')
            ->where('subscriptions.id', (int) $subscriptionId)
            ->where('subscriptions.member_id', $memberId)
            ->whereIn('subscriptions.status', ['active', 'frozen'])
            ->where(function ($branchScope) use ($branchId) {
                $branchScope->where('packages.allows_all_branches', true)
                    ->orWhere('packages.branch_id', $branchId)
                    ->orWhereExists(function ($exists) use ($branchId) {
                        $exists->select(DB::raw(1))
                            ->from('package_branch_access as pba')
                            ->whereColumn('pba.package_id', 'packages.id')
                            ->where('pba.branch_id', $branchId);
                    });
            })
            ->exists();
    }

    private function coachCanWorkBranch(int $coachId, int $branchId): bool
    {
        return DB::table('coaches')
            ->where('id', $coachId)
            ->where(function ($branchScope) use ($branchId) {
                $branchScope->where('branch_id', $branchId)
                    ->orWhereExists(function ($exists) use ($branchId) {
                        $exists->select(DB::raw(1))
                            ->from('coach_branch_access as cba')
                            ->whereColumn('cba.coach_id', 'coaches.id')
                            ->where('cba.branch_id', $branchId);
                    });
            })
            ->exists();
    }

    /**
     * @return array<int, int>
     */
    private function visibleBranchIdsForActor(User $actor): array
    {
        $branchIds = collect([$actor->branch_id])
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value);

        if ($actor->role === 'member') {
            $member = $this->memberForActor($actor);
            if ($member) {
                $branchIds = $branchIds
                    ->push($member->branch_id)
                    ->merge(
                        DB::table('member_branch_access')
                            ->where('member_id', $member->id)
                            ->pluck('branch_id')
                    );

                $ptPackageBranches = DB::table('subscriptions')
                    ->join('packages', 'subscriptions.package_id', '=', 'packages.id')
                    ->leftJoin('package_branch_access as pba', 'packages.id', '=', 'pba.package_id')
                    ->where('subscriptions.member_id', $member->id)
                    ->whereIn('subscriptions.status', ['active', 'frozen'])
                    ->whereRaw('(subscriptions.pt_sessions_total - subscriptions.pt_sessions_used) > 0')
                    ->select([
                        'packages.allows_all_branches as allowsAllBranches',
                        'packages.branch_id as packageBranchId',
                        'pba.branch_id as accessBranchId',
                    ])
                    ->get();

                if ($ptPackageBranches->contains(fn ($row) => (bool) $row->allowsAllBranches)) {
                    $branchIds = $branchIds->merge(DB::table('branches')->pluck('id'));
                }

                $branchIds = $branchIds->merge(
                    $ptPackageBranches
                        ->flatMap(fn ($row) => [$row->packageBranchId, $row->accessBranchId])
                        ->filter(fn ($value) => $value !== null)
                );
            }
        }

        if ($actor->role === 'coach') {
            $coach = DB::table('coaches')
                ->where('user_id', $actor->id)
                ->select(['id', 'branch_id'])
                ->first();

            if ($coach) {
                $branchIds = $branchIds
                    ->push($coach->branch_id)
                    ->merge(
                        DB::table('coach_branch_access')
                            ->where('coach_id', $coach->id)
                            ->pluck('branch_id')
                    );
            }
        }

        return $branchIds
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();
    }

    private function canCancelBeforeCutoff(PtSession $session): bool
    {
        $sessionDateTime = Carbon::parse($session->session_date->toDateString() . ' ' . $session->start_time);

        return $sessionDateTime->gt(now()->addHours(6));
    }
}
