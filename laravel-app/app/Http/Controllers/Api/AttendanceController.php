<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $memberId = $request->query('memberId');
        $branchId = $actor->role === 'owner' ? null : $actor->branch_id;

        $query = DB::table('attendance')
            ->leftJoin('members', 'attendance.member_id', '=', 'members.id')
            ->leftJoin('users', 'members.user_id', '=', 'users.id')
            ->leftJoin('branches', 'attendance.branch_id', '=', 'branches.id')
            ->leftJoin('classes', 'attendance.class_id', '=', 'classes.id')
            ->select([
                'attendance.id',
                'attendance.class_id as classId',
                'attendance.member_id as memberId',
                'attendance.branch_id as branchId',
                'attendance.checkin_time as checkinTime',
                'attendance.attendance_type as attendanceType',
                'attendance.checkin_source as checkinSource',
                'attendance.access_granted as accessGranted',
                'attendance.device_identifier as deviceIdentifier',
                'attendance.marked_by as markedBy',
                'attendance.notes',
                'users.name as memberName',
                'branches.name as branchName',
                'classes.title as classTitle',
            ])
            ->orderByDesc('attendance.checkin_time');

        if ($branchId) {
            $query->where('attendance.branch_id', $branchId);
        }

        if ($memberId) {
            $query->where('attendance.member_id', (int) $memberId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'classId' => ['nullable', 'integer', 'exists:classes,id'],
            'memberId' => ['required', 'integer', 'exists:members,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'attendanceType' => ['required', Rule::in(['gym_entry', 'class_attendance'])],
            'checkinSource' => ['nullable', Rule::in(['manual', 'face_device', 'system'])],
            'deviceIdentifier' => ['nullable', 'string', 'max:255'],
            'manualOverride' => ['nullable', 'boolean'],
            'markedBy' => ['nullable', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $member = DB::table('members')->where('id', $validated['memberId'])->first();
        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        $source = $validated['checkinSource'] ?? 'manual';
        $manualOverride = (bool) ($validated['manualOverride'] ?? false);

        $accessGranted = $this->canCheckIn($validated['memberId'], $validated['attendanceType'], $validated['classId'] ?? null);
        if (!$accessGranted && !$manualOverride) {
            return response()->json(['message' => 'Member is not eligible for automatic check-in'], 422);
        }

        $record = DB::transaction(function () use ($validated, $source, $accessGranted, $manualOverride) {
            $record = Attendance::query()->create([
                'class_id' => $validated['classId'] ?? null,
                'member_id' => $validated['memberId'],
                'branch_id' => $validated['branchId'],
                'attendance_type' => $validated['attendanceType'],
                'checkin_source' => $source,
                'access_granted' => $accessGranted || $manualOverride,
                'device_identifier' => $validated['deviceIdentifier'] ?? null,
                'marked_by' => $validated['markedBy'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($validated['attendanceType'] === 'class_attendance' && !empty($validated['classId'])) {
                DB::table('class_bookings')
                    ->where('class_id', $validated['classId'])
                    ->where('member_id', $validated['memberId'])
                    ->whereIn('status', ['booked', 'waitlisted'])
                    ->update([
                        'status' => 'attended',
                        'attendance_marked_at' => now(),
                    ]);
            }

            return $record;
        });

        return response()->json($record, 201);
    }

    private function canCheckIn(int $memberId, string $attendanceType, ?int $classId): bool
    {
        $activeSubscription = DB::table('subscriptions')
            ->where('member_id', $memberId)
            ->whereIn('status', ['active', 'frozen'])
            ->whereDate('end_date', '>=', now()->toDateString())
            ->exists();

        if ($attendanceType === 'gym_entry') {
            return $activeSubscription;
        }

        if (!$classId) {
            return false;
        }

        $booking = DB::table('class_bookings')
            ->where('class_id', $classId)
            ->where('member_id', $memberId)
            ->whereIn('status', ['booked', 'waitlisted'])
            ->exists();

        return $activeSubscription && $booking;
    }
}
