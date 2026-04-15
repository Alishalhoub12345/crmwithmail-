<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymClass;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GymClassController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = DB::table('classes')
            ->leftJoin('coaches', 'classes.coach_id', '=', 'coaches.id')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'classes.branch_id', '=', 'branches.id')
            ->select([
                'classes.id',
                'classes.branch_id as branchId',
                'classes.title',
                'classes.description',
                'classes.coach_id as coachId',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'classes.end_time as endTime',
                'classes.capacity',
                'classes.price',
                'classes.price_type as priceType',
                'classes.enable_waitlist as enableWaitlist',
                'classes.price_extra as priceExtra',
                'classes.requires_extra_payment as requiresExtraPayment',
                'classes.status',
                'classes.cancellation_reason as cancellationReason',
                'classes.canceled_at as canceledAt',
                DB::raw("(select count(*) from class_bookings where class_bookings.class_id = classes.id and class_bookings.status in ('booked','attended')) as bookedCount"),
                DB::raw("(select count(*) from class_bookings where class_bookings.class_id = classes.id and class_bookings.status = 'waitlisted') as waitlistCount"),
                'users.name as coachName',
                DB::raw("COALESCE(branches.name, 'All branches') as branchName"),
            ])
            ->orderByDesc('classes.class_date');

        if ($actor->role !== 'owner') {
            $query->where(function ($builder) use ($actor) {
                $builder
                    ->where('classes.branch_id', $actor->branch_id)
                    ->orWhereNull('classes.branch_id');
            });
        }

        return response()->json($query->get());
    }

    public function show(int $id): JsonResponse
    {
        $class = DB::table('classes')
            ->leftJoin('coaches', 'classes.coach_id', '=', 'coaches.id')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'classes.branch_id', '=', 'branches.id')
            ->select([
                'classes.id',
                'classes.branch_id as branchId',
                'classes.title',
                'classes.description',
                'classes.coach_id as coachId',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'classes.end_time as endTime',
                'classes.capacity',
                'classes.price',
                'classes.price_type as priceType',
                'classes.enable_waitlist as enableWaitlist',
                'classes.price_extra as priceExtra',
                'classes.requires_extra_payment as requiresExtraPayment',
                'classes.status',
                'classes.cancellation_reason as cancellationReason',
                'classes.canceled_at as canceledAt',
                DB::raw("(select count(*) from class_bookings where class_bookings.class_id = classes.id and class_bookings.status in ('booked','attended')) as bookedCount"),
                DB::raw("(select count(*) from class_bookings where class_bookings.class_id = classes.id and class_bookings.status = 'waitlisted') as waitlistCount"),
                'users.name as coachName',
                DB::raw("COALESCE(branches.name, 'All branches') as branchName"),
            ])
            ->where('classes.id', $id)
            ->first();

        if (!$class) {
            return response()->json(['message' => 'Class not found'], 404);
        }

        return response()->json($class);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'coachId' => ['nullable', 'integer', 'exists:coaches,id'],
            'classDate' => ['nullable', 'date'],
            'recurrenceStartDate' => ['nullable', 'date'],
            'recurrenceEndDate' => ['nullable', 'date', 'after_or_equal:recurrenceStartDate'],
            'weekdays' => ['nullable', 'array', 'min:1'],
            'weekdays.*' => ['string', Rule::in(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])],
            'startTime' => ['nullable', 'string', 'max:32'],
            'endTime' => ['nullable', 'string', 'max:32'],
            'daySchedules' => ['nullable', 'array', 'min:1'],
            'daySchedules.*.weekday' => ['required_with:daySchedules', 'string', Rule::in(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])],
            'daySchedules.*.startTime' => ['required_with:daySchedules', 'string', 'max:32'],
            'daySchedules.*.endTime' => ['required_with:daySchedules', 'string', 'max:32'],
            'capacity' => ['required', 'integer'],
            'price' => ['required', 'numeric', 'min:0'],
            'priceType' => ['required', Rule::in(['per_class', 'monthly'])],
            'enableWaitlist' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['scheduled', 'canceled', 'completed'])],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $hasRecurrence = !empty($validated['recurrenceStartDate']) || !empty($validated['recurrenceEndDate']) || !empty($validated['weekdays']);
        $hasSharedTime = !empty($validated['startTime']) && !empty($validated['endTime']);
        $hasDaySchedules = !empty($validated['daySchedules']);

        if (!$hasRecurrence && !$hasSharedTime) {
            return response()->json(['message' => 'Start time and end time are required'], 422);
        }

        if ($hasRecurrence && !$hasSharedTime && !$hasDaySchedules) {
            return response()->json(['message' => 'Provide either one shared time or weekday-specific times for recurring classes'], 422);
        }

        $dayScheduleMap = [];
        if ($hasDaySchedules) {
            foreach ($validated['daySchedules'] as $schedule) {
                $dayScheduleMap[strtolower($schedule['weekday'])] = [
                    'start_time' => $schedule['startTime'],
                    'end_time' => $schedule['endTime'],
                ];
            }
        }

        $basePayload = [
            'branch_id' => $validated['branchId'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'coach_id' => $validated['coachId'] ?? null,
            'capacity' => $validated['capacity'],
            'price' => $validated['price'],
            'price_type' => $validated['priceType'],
            'enable_waitlist' => $validated['enableWaitlist'] ?? true,
            'status' => $validated['status'] ?? 'scheduled',
            'cancellation_reason' => $validated['cancellationReason'] ?? null,
            'canceled_at' => ($validated['status'] ?? 'scheduled') === 'canceled' ? now() : null,
        ];

        if ($hasRecurrence) {
            if (empty($validated['recurrenceStartDate']) || empty($validated['recurrenceEndDate']) || empty($validated['weekdays'])) {
                return response()->json(['message' => 'Start date, end date, and weekdays are required for recurring classes'], 422);
            }

            $dates = [];
            $cursor = Carbon::parse($validated['recurrenceStartDate'])->startOfDay();
            $end = Carbon::parse($validated['recurrenceEndDate'])->startOfDay();
            $weekdays = array_map('strtolower', $validated['weekdays']);

            if ($hasDaySchedules) {
                $missingWeekdays = array_values(array_diff($weekdays, array_keys($dayScheduleMap)));
                if (count($missingWeekdays) > 0) {
                    return response()->json(['message' => 'Each selected weekday must have a start and end time'], 422);
                }
            }

            while ($cursor->lte($end)) {
                if (in_array(strtolower($cursor->englishDayOfWeek), $weekdays, true)) {
                    $dates[] = $cursor->toDateString();
                }
                $cursor->addDay();
            }

            if (count($dates) === 0) {
                return response()->json(['message' => 'No class dates match the selected weekdays in this range'], 422);
            }

            $created = DB::transaction(function () use ($dates, $basePayload, $dayScheduleMap, $validated) {
                $rows = [];
                foreach ($dates as $date) {
                    $weekday = strtolower(Carbon::parse($date)->englishDayOfWeek);
                    $timePayload = $dayScheduleMap[$weekday] ?? [
                        'start_time' => $validated['startTime'],
                        'end_time' => $validated['endTime'],
                    ];

                    $rows[] = GymClass::query()->create([
                        ...$basePayload,
                        ...$timePayload,
                        'class_date' => $date,
                    ]);
                }

                return $rows;
            });

            return response()->json([
                'message' => count($created) > 1 ? 'Classes created' : 'Class created',
                'count' => count($created),
                'classes' => $created,
            ], 201);
        }

        if (empty($validated['classDate'])) {
            return response()->json(['message' => 'Date is required'], 422);
        }

        $class = GymClass::query()->create([
            ...$basePayload,
            'start_time' => $validated['startTime'],
            'end_time' => $validated['endTime'],
            'class_date' => $validated['classDate'],
        ]);

        return response()->json([
            'message' => 'Class created',
            'count' => 1,
            'classes' => [$class],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $class = GymClass::query()->find($id);
        if (!$class) {
            return response()->json(['message' => 'Class not found'], 404);
        }

        $validated = $request->validate([
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'coachId' => ['nullable', 'integer', 'exists:coaches,id'],
            'classDate' => ['sometimes', 'required', 'date'],
            'startTime' => ['sometimes', 'required', 'string', 'max:32'],
            'endTime' => ['sometimes', 'required', 'string', 'max:32'],
            'capacity' => ['sometimes', 'required', 'integer'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'priceType' => ['sometimes', 'required', Rule::in(['per_class', 'monthly'])],
            'enableWaitlist' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['scheduled', 'canceled', 'completed'])],
            'cancellationReason' => ['nullable', 'string'],
        ]);

        $mapping = [
            'branchId' => 'branch_id',
            'title' => 'title',
            'description' => 'description',
            'coachId' => 'coach_id',
            'classDate' => 'class_date',
            'startTime' => 'start_time',
            'endTime' => 'end_time',
            'capacity' => 'capacity',
            'price' => 'price',
            'priceType' => 'price_type',
            'enableWaitlist' => 'enable_waitlist',
            'status' => 'status',
            'cancellationReason' => 'cancellation_reason',
        ];
        $payload = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $payload[$column] = $validated[$input];
            }
        }

        if (array_key_exists('status', $validated)) {
            $payload['canceled_at'] = $validated['status'] === 'canceled' ? now() : null;
        }

        $class->fill($payload)->save();
        return response()->json($class->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $class = GymClass::query()->find($id);
        if (!$class) {
            return response()->json(['message' => 'Class not found'], 404);
        }
        $class->delete();
        return response()->json([], 204);
    }
}
