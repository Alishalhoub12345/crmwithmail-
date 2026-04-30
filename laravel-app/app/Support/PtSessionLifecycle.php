<?php

namespace App\Support;

use App\Models\Member;
use App\Models\PtSession;
use App\Models\Subscription;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PtSessionLifecycle
{
    public const CREDIT_CONSUMING_STATUSES = ['completed', 'late_canceled', 'no_show'];
    public const BUSY_STATUSES = ['pending', 'scheduled'];

    public function syncAutoCompletedSessions(?Carbon $now = null): int
    {
        $now ??= now();
        $today = $now->toDateString();
        $currentTime = $now->format('H:i');

        $sessionIds = PtSession::query()
            ->where('status', 'scheduled')
            ->where(function ($query) use ($today, $currentTime) {
                $query->whereDate('session_date', '<', $today)
                    ->orWhere(function ($sameDay) use ($today, $currentTime) {
                        $sameDay->whereDate('session_date', $today)
                            ->where('end_time', '<=', $currentTime);
                    });
            })
            ->pluck('id');

        $completed = 0;
        foreach ($sessionIds as $sessionId) {
            DB::transaction(function () use ($sessionId, $now, &$completed) {
                $session = PtSession::query()
                    ->whereKey($sessionId)
                    ->lockForUpdate()
                    ->first();

                if (!$session || $session->status !== 'scheduled' || !$this->sessionHasEnded($session, $now)) {
                    return;
                }

                $session->status = 'completed';
                $session->completed_at = $now;
                $session->save();

                $this->reconcileCreditUsageForSession($session);
                $completed++;
            });
        }

        return $completed;
    }

    public function reconcileCreditUsageForSession(PtSession $session): void
    {
        $this->reconcileCreditUsage(
            $session->subscription_id ? (int) $session->subscription_id : null,
            (int) $session->member_id
        );
    }

    public function reconcileCreditUsage(?int $subscriptionId, int $memberId): void
    {
        if ($subscriptionId !== null) {
            $this->reconcileSubscriptionCredits($subscriptionId);
            return;
        }

        $this->reconcileManualMemberCredits($memberId);
    }

    private function sessionHasEnded(PtSession $session, Carbon $now): bool
    {
        $sessionDate = $session->session_date instanceof Carbon
            ? $session->session_date->toDateString()
            : Carbon::parse($session->session_date)->toDateString();

        return Carbon::parse($sessionDate . ' ' . $session->end_time)->lte($now);
    }

    private function reconcileSubscriptionCredits(int $subscriptionId): void
    {
        $subscription = Subscription::query()
            ->whereKey($subscriptionId)
            ->lockForUpdate()
            ->first();

        if (!$subscription) {
            return;
        }

        $used = PtSession::query()
            ->where('subscription_id', $subscriptionId)
            ->whereIn('status', self::CREDIT_CONSUMING_STATUSES)
            ->count();

        $subscription->pt_sessions_used = min((int) $used, (int) $subscription->pt_sessions_total);
        $subscription->status = $subscription->is_frozen ? 'frozen' : $subscription->status;
        $subscription->save();
    }

    private function reconcileManualMemberCredits(int $memberId): void
    {
        $member = Member::query()
            ->whereKey($memberId)
            ->lockForUpdate()
            ->first();

        if (!$member) {
            return;
        }

        $used = PtSession::query()
            ->where('member_id', $memberId)
            ->whereNull('subscription_id')
            ->whereIn('status', self::CREDIT_CONSUMING_STATUSES)
            ->count();

        $member->manual_pt_credits_used = min((int) $used, (int) $member->manual_pt_credits_total);
        $member->save();
    }
}
