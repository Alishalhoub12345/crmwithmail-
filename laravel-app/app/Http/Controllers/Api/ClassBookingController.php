<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassBooking;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClassBookingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $classId = $request->query('classId');
        $memberId = $request->query('memberId');

        $query = DB::table('class_bookings')
            ->leftJoin('classes', 'class_bookings.class_id', '=', 'classes.id')
            ->leftJoin('members', 'class_bookings.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('subscriptions', 'class_bookings.subscription_id', '=', 'subscriptions.id')
            ->select([
                'class_bookings.id',
                'class_bookings.class_id as classId',
                'class_bookings.member_id as memberId',
                'class_bookings.booking_type as bookingType',
                'class_bookings.subscription_id as subscriptionId',
                'class_bookings.payment_id as paymentId',
                'class_bookings.waitlist_position as waitlistPosition',
                'class_bookings.restricted_until as restrictedUntil',
                'class_bookings.cancellation_reason as cancellationReason',
                'class_bookings.attendance_marked_at as attendanceMarkedAt',
                'class_bookings.status',
                'class_bookings.booked_at as bookedAt',
                'classes.title as classTitle',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'classes.capacity',
                'users.name as memberName',
                'subscriptions.remaining_classes as remainingClasses',
            ])
            ->orderByDesc('class_bookings.booked_at');

        if ($actor->role !== 'owner') {
            $query->where(function ($builder) use ($actor) {
                $builder
                    ->where('classes.branch_id', $actor->branch_id)
                    ->orWhereNull('classes.branch_id');
            });
        }

        if ($classId) {
            $query->where('class_bookings.class_id', (int) $classId);
        }

        if ($memberId) {
            $query->where('class_bookings.member_id', (int) $memberId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'classId' => ['required', 'integer', 'exists:classes,id'],
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'bookingType' => ['required', Rule::in(['package', 'extra_payment'])],
            'subscriptionId' => ['nullable', 'integer', 'exists:subscriptions,id'],
            'paymentId' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['booked', 'waitlisted', 'attended', 'canceled', 'late_canceled', 'no_show'])],
        ]);

        $class = DB::table('classes')->where('id', $validated['classId'])->first();
        if (!$class || $class->status !== 'scheduled') {
            return response()->json(['message' => 'Class is not open for bookings'], 422);
        }

        $member = DB::table('members')->where('id', $validated['memberId'])->first();
        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        $existingRestriction = DB::table('class_bookings')
            ->where('member_id', $validated['memberId'])
            ->whereNotNull('restricted_until')
            ->where('restricted_until', '>', now())
            ->max('restricted_until');

        if ($existingRestriction) {
            return response()->json(['message' => 'Member is temporarily restricted from bookings'], 422);
        }

        $duplicate = DB::table('class_bookings')
            ->where('class_id', $validated['classId'])
            ->where('member_id', $validated['memberId'])
            ->whereIn('status', ['booked', 'waitlisted', 'attended'])
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => 'Member already has a booking for this class'], 422);
        }

        if ($validated['bookingType'] === 'package') {
            $subscription = Subscription::query()->find($validated['subscriptionId'] ?? 0);
            if (!$subscription || (int) $subscription->member_id !== (int) $validated['memberId']) {
                return response()->json(['message' => 'Valid subscription is required for package booking'], 422);
            }
            if ($subscription->status !== 'active' && $subscription->status !== 'frozen') {
                return response()->json(['message' => 'Subscription is not active'], 422);
            }
            if (Carbon::parse($class->class_date)->gt(Carbon::parse($subscription->end_date))) {
                return response()->json(['message' => 'Class is beyond the subscription expiry date'], 422);
            }

            $package = DB::table('packages')->where('id', $subscription->package_id)->first();
            if (!$package || !(bool) $package->includes_classes) {
                return response()->json(['message' => 'This package does not include classes'], 422);
            }

            if (!(bool) $package->allows_all_branches && $package->branch_id && $class->branch_id && (int) $package->branch_id !== (int) $class->branch_id) {
                return response()->json(['message' => 'This package only covers classes in its selected branch'], 422);
            }

            $selectedClassTitles = json_decode($package->selected_class_titles ?? 'null', true);
            if (is_array($selectedClassTitles) && count($selectedClassTitles) === 0) {
                return response()->json(['message' => 'This package has no class types selected'], 422);
            }

            if (is_array($selectedClassTitles) && count($selectedClassTitles) > 0) {
                $normalizedSelectedTitles = array_map(
                    fn ($title) => $this->normalizeClassTitle((string) $title),
                    $selectedClassTitles
                );

                if (!in_array($this->normalizeClassTitle((string) $class->title), $normalizedSelectedTitles, true)) {
                    return response()->json(['message' => 'This package does not cover the selected class type'], 422);
                }
            }

            $selectedClassIds = json_decode($package->selected_class_ids ?? 'null', true);
            if (is_array($selectedClassIds) && count($selectedClassIds) > 0 && !in_array((int) $class->id, array_map('intval', $selectedClassIds), true)) {
                return response()->json(['message' => 'This package does not cover the selected class'], 422);
            }

            $remainingClassCredits = $subscription->remaining_class_credits;
            if (is_array($remainingClassCredits) && count($remainingClassCredits) > 0) {
                $creditKey = $this->findClassCreditKey($remainingClassCredits, (string) $class->title);
                if ($creditKey === null || (int) ($remainingClassCredits[$creditKey] ?? 0) <= 0) {
                    return response()->json(['message' => 'No remaining credits for this class type'], 422);
                }
            }
        }

        $activeBookings = DB::table('class_bookings')
            ->where('class_id', $validated['classId'])
            ->whereIn('status', ['booked', 'attended'])
            ->count();

        $waitlistPosition = null;
        $status = $validated['status'] ?? 'booked';

        if ($activeBookings >= (int) $class->capacity && $status === 'booked') {
            if (!(bool) $class->enable_waitlist) {
                return response()->json(['message' => 'Class is full and waitlist is disabled'], 422);
            }

            $status = 'waitlisted';
            $waitlistPosition = (int) DB::table('class_bookings')
                ->where('class_id', $validated['classId'])
                ->where('status', 'waitlisted')
                ->max('waitlist_position') + 1;
        }

        $booking = ClassBooking::query()->create([
            'class_id' => $validated['classId'],
            'member_id' => $validated['memberId'],
            'booking_type' => $validated['bookingType'],
            'subscription_id' => $validated['subscriptionId'] ?? null,
            'payment_id' => $validated['paymentId'] ?? null,
            'waitlist_position' => $waitlistPosition,
            'status' => $status,
        ]);

        return response()->json($booking, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $booking = ClassBooking::query()->find($id);
        if (!$booking) {
            return response()->json(['message' => 'Booking not found'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['booked', 'waitlisted', 'attended', 'canceled', 'late_canceled', 'no_show'])],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $updated = DB::transaction(function () use ($booking, $validated) {
            $previousStatus = $booking->status;
            $nextStatus = $validated['status'];

            $booking->status = $nextStatus;
            $booking->cancellation_reason = $validated['cancellationReason'] ?? null;
            $booking->attendance_marked_at = $nextStatus === 'attended' ? now() : $booking->attendance_marked_at;

            if ($nextStatus === 'no_show') {
                $booking->restricted_until = now()->addDays(7);
            }

            $booking->save();

            if ($booking->booking_type === 'package' && $booking->subscription_id) {
                $this->applySubscriptionImpact((int) $booking->subscription_id, (int) $booking->class_id, $previousStatus, $nextStatus);
            }

            if (in_array($nextStatus, ['canceled', 'late_canceled', 'no_show'], true)) {
                $this->promoteWaitlist((int) $booking->class_id);
            }

            return $booking->fresh();
        });

        return response()->json($updated);
    }

    private function applySubscriptionImpact(int $subscriptionId, int $classId, string $previousStatus, string $nextStatus): void
    {
        $subscription = Subscription::query()->find($subscriptionId);
        if (!$subscription) {
            return;
        }

        $previousConsumes = $previousStatus === 'attended';
        $nextConsumes = $nextStatus === 'attended';
        $delta = ($nextConsumes ? 1 : 0) - ($previousConsumes ? 1 : 0);

        if ($delta === 0 || $subscription->remaining_classes === null) {
            $this->applyClassTypeCreditImpact($subscription, $classId, $delta);
            $subscription->save();
            return;
        }

        $subscription->remaining_classes = max(0, (int) $subscription->remaining_classes - $delta);
        $this->applyClassTypeCreditImpact($subscription, $classId, $delta);
        $subscription->save();
    }

    private function applyClassTypeCreditImpact(Subscription $subscription, int $classId, int $delta): void
    {
        if ($delta === 0 || !is_array($subscription->remaining_class_credits) || count($subscription->remaining_class_credits) === 0) {
            return;
        }

        $classTitle = DB::table('classes')->where('id', $classId)->value('title');
        if (!$classTitle) {
            return;
        }

        $credits = $subscription->remaining_class_credits;
        $creditKey = $this->findClassCreditKey($credits, (string) $classTitle);
        if ($creditKey === null) {
            return;
        }

        $credits[$creditKey] = max(0, (int) ($credits[$creditKey] ?? 0) - $delta);
        $subscription->remaining_class_credits = $credits;
    }

    private function findClassCreditKey(array $credits, string $classTitle): ?string
    {
        $target = $this->normalizeClassTitle($classTitle);

        foreach ($credits as $title => $count) {
            if ($this->normalizeClassTitle((string) $title) === $target) {
                return (string) $title;
            }
        }

        return null;
    }

    private function normalizeClassTitle(string $title): string
    {
        return mb_strtolower(trim($title));
    }

    private function promoteWaitlist(int $classId): void
    {
        $next = ClassBooking::query()
            ->where('class_id', $classId)
            ->where('status', 'waitlisted')
            ->orderBy('waitlist_position')
            ->first();

        if (!$next) {
            return;
        }

        $next->status = 'booked';
        $next->waitlist_position = null;
        $next->save();

        $remaining = ClassBooking::query()
            ->where('class_id', $classId)
            ->where('status', 'waitlisted')
            ->orderBy('waitlist_position')
            ->get();

        $position = 1;
        foreach ($remaining as $booking) {
            $booking->waitlist_position = $position++;
            $booking->save();
        }
    }
}
