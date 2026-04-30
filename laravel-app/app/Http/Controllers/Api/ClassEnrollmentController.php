<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ClassAttendanceRestoredMail;
use App\Mail\ClassNoShowReviewMail;
use App\Models\ClassEnrollment;
use App\Models\ClassEnrollmentBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class ClassEnrollmentController extends Controller
{
    /**
     * Enroll a member in a class
     */
    public function enroll(Request $request): JsonResponse
    {
        $actor = $request->user();
        $validated = $request->validate([
            'memberId' => 'required|integer|exists:members,id',
            'classId' => 'required|integer|exists:classes,id',
        ]);

        if ($actor->role === 'member') {
            $ownsMemberProfile = DB::table('members')
                ->where('id', $validated['memberId'])
                ->where('user_id', $actor->id)
                ->exists();

            if (!$ownsMemberProfile) {
                return response()->json(['message' => 'You can only enroll yourself'], 403);
            }
        }

        return DB::transaction(function () use ($validated) {
            $class = DB::table('classes')
                ->where('id', $validated['classId'])
                ->lockForUpdate()
                ->first();

            if (!$class || $class->status !== 'active') {
                return response()->json(['message' => 'Class is not open for enrollment'], 422);
            }

            $member = DB::table('members')
                ->where('id', $validated['memberId'])
                ->lockForUpdate()
                ->first();

            if (!$member || $member->status !== 'active' || $member->is_frozen) {
                return response()->json(['message' => 'Member account is not active'], 422);
            }

            $isBlocked = ClassEnrollmentBlock::where('member_id', $validated['memberId'])
                ->whereNull('unblocked_at')
                ->lockForUpdate()
                ->exists();

            if ($isBlocked) {
                return response()->json([
                    'message' => 'You cannot enroll in classes until the front desk reviews and unblocks your class reservation access.',
                    'blocked' => true,
                ], 403);
            }

            $existing = ClassEnrollment::where('member_id', $validated['memberId'])
                ->where('class_id', $validated['classId'])
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return response()->json(['message' => 'Member already enrolled in this class'], 409);
            }

            $reservedSlots = ClassEnrollment::where('class_id', $validated['classId'])
                ->where(function ($query) {
                    $query->whereNull('attended')
                        ->orWhere('attended', true);
                })
                ->lockForUpdate()
                ->count();

            if ($reservedSlots >= (int) $class->capacity) {
                return response()->json(['message' => 'Class is full'], 422);
            }

            $enrollment = ClassEnrollment::create([
                'member_id' => $validated['memberId'],
                'class_id' => $validated['classId'],
                'enrolled_at' => now(),
            ]);

            return response()->json(['message' => 'Enrolled successfully', 'enrollment' => $enrollment], 201);
        });
    }

    /**
     * Get all enrollments for a class with member details
     */
    public function getEnrollments(Request $request, int $classId): JsonResponse
    {
        $actor = $request->user();

        if ($actor->role === 'coach') {
            $ownsClass = DB::table('classes')
                ->join('coaches', 'classes.coach_id', '=', 'coaches.id')
                ->where('classes.id', $classId)
                ->where('coaches.user_id', $actor->id)
                ->exists();

            if (!$ownsClass) {
                return response()->json(['message' => 'You can only review your own classes'], 403);
            }
        }

        $enrollments = ClassEnrollment::where('class_id', $classId)
            ->join('members', 'class_enrollments.member_id', '=', 'members.id')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->select([
                'class_enrollments.id',
                'class_enrollments.member_id as memberId',
                'class_enrollments.class_id as classId',
                'class_enrollments.attended',
                'class_enrollments.enrolled_at as enrolledAt',
                'users.name as memberName',
                'users.email as memberEmail',
                'members.status',
            ])
            ->get();

        return response()->json($enrollments);
    }

    /**
     * Mark attendance for a class enrollment
     */
    public function markAttendance(Request $request): JsonResponse
    {
        $actor = $request->user();
        $validated = $request->validate([
            'enrollmentId' => 'required|integer|exists:class_enrollments,id',
            'attended' => 'required|boolean',
        ]);

        $enrollment = ClassEnrollment::findOrFail($validated['enrollmentId']);
        $wasNoShow = $enrollment->attended === false;

        if ($actor->role === 'coach') {
            $ownsClass = DB::table('class_enrollments')
                ->join('classes', 'class_enrollments.class_id', '=', 'classes.id')
                ->join('coaches', 'classes.coach_id', '=', 'coaches.id')
                ->where('class_enrollments.id', $enrollment->id)
                ->where('coaches.user_id', $actor->id)
                ->exists();

            if (!$ownsClass) {
                return response()->json(['message' => 'You can only mark attendance for your own classes'], 403);
            }
        }

        $enrollment->update(['attended' => $validated['attended']]);
        $enrollment = $enrollment->fresh();

        // If member didn't attend, check and apply block if needed
        if (!$validated['attended']) {
            $policyResult = $this->syncNoShowBlock($enrollment->member_id, $actor->id);
            if (!$wasNoShow || $policyResult['newlyBlocked']) {
                $this->sendNoShowReviewMail(
                    enrollment: $enrollment,
                    noShowCount: $policyResult['noShowCount'],
                    isBlocked: $policyResult['isBlocked'],
                );
            }
        } elseif ($wasNoShow) {
            $policyResult = $this->syncNoShowBlock($enrollment->member_id, $actor->id);
            $this->sendAttendanceRestoredMail(
                enrollment: $enrollment,
                noShowCount: $policyResult['noShowCount'],
                isBlocked: $policyResult['isBlocked'],
            );
        }

        return response()->json(['message' => 'Attendance marked', 'enrollment' => $enrollment]);
    }

    private function sendNoShowReviewMail(ClassEnrollment $enrollment, int $noShowCount, bool $isBlocked): void
    {
        $details = DB::table('class_enrollments')
            ->join('members', 'class_enrollments.member_id', '=', 'members.id')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->join('classes', 'class_enrollments.class_id', '=', 'classes.id')
            ->leftJoin('branches', 'classes.branch_id', '=', 'branches.id')
            ->where('class_enrollments.id', $enrollment->id)
            ->select([
                'users.name as memberName',
                'users.email as memberEmail',
                'classes.title as classTitle',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'branches.name as branchName',
            ])
            ->first();

        if (!$details?->memberEmail) {
            return;
        }

        Mail::to($details->memberEmail)->send(new ClassNoShowReviewMail(
            memberName: $details->memberName ?: 'member',
            classTitle: $details->classTitle ?: 'Class',
            classDate: (string) $details->classDate,
            startTime: (string) $details->startTime,
            branchName: $details->branchName ?: 'All branches',
            noShowCount: $noShowCount,
            isBlocked: $isBlocked,
        ));
    }

    private function sendAttendanceRestoredMail(ClassEnrollment $enrollment, int $noShowCount, bool $isBlocked): void
    {
        $details = $this->mailDetailsForEnrollment($enrollment);

        if (!$details?->memberEmail) {
            return;
        }

        Mail::to($details->memberEmail)->send(new ClassAttendanceRestoredMail(
            memberName: $details->memberName ?: 'member',
            classTitle: $details->classTitle ?: 'Class',
            classDate: (string) $details->classDate,
            startTime: (string) $details->startTime,
            branchName: $details->branchName ?: 'All branches',
            noShowCount: $noShowCount,
            isBlocked: $isBlocked,
        ));
    }

    private function mailDetailsForEnrollment(ClassEnrollment $enrollment): ?object
    {
        return DB::table('class_enrollments')
            ->join('members', 'class_enrollments.member_id', '=', 'members.id')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->join('classes', 'class_enrollments.class_id', '=', 'classes.id')
            ->leftJoin('branches', 'classes.branch_id', '=', 'branches.id')
            ->where('class_enrollments.id', $enrollment->id)
            ->select([
                'users.name as memberName',
                'users.email as memberEmail',
                'classes.title as classTitle',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'branches.name as branchName',
            ])
            ->first();
    }

    /**
     * Keep the active no-show block aligned with the member's current no-show count.
     *
     * @return array{noShowCount: int, isBlocked: bool, newlyBlocked: bool}
     */
    private function syncNoShowBlock(int $memberId, ?int $blockedBy): array
    {
        $noShowCount = ClassEnrollment::where('member_id', $memberId)
            ->where('attended', false)
            ->count();

        $existingBlock = ClassEnrollmentBlock::where('member_id', $memberId)
            ->whereNull('unblocked_at')
            ->first();
        $newlyBlocked = false;

        // Block on 2nd no-show
        if ($noShowCount >= 2 && !$existingBlock) {
            $existingBlock = ClassEnrollmentBlock::create([
                'member_id' => $memberId,
                'reason' => 'excessive_no_shows',
                'blocked_by' => $blockedBy,
                'blocked_at' => now(),
            ]);
            $newlyBlocked = true;
        }

        if ($noShowCount < 2 && $existingBlock) {
            $existingBlock->update(['unblocked_at' => now()]);
            $existingBlock = null;
        }

        return [
            'noShowCount' => $noShowCount,
            'isBlocked' => (bool) $existingBlock,
            'newlyBlocked' => $newlyBlocked,
        ];
    }

    /**
     * Get all blocked members
     */
    public function getBlockedMembers(): JsonResponse
    {
        $blockedMembers = ClassEnrollmentBlock::whereNull('unblocked_at')
            ->join('members', 'class_enrollment_blocks.member_id', '=', 'members.id')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->select([
                'class_enrollment_blocks.id as blockId',
                'class_enrollment_blocks.member_id as memberId',
                'class_enrollment_blocks.reason',
                'class_enrollment_blocks.blocked_at as blockedAt',
                'users.name as memberName',
                'users.email as memberEmail',
            ])
            ->get();

        return response()->json($blockedMembers);
    }

    /**
     * Unblock a member from class enrollment
     */
    public function unblockMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'memberId' => 'required|integer|exists:members,id',
        ]);

        ClassEnrollmentBlock::where('member_id', $validated['memberId'])
            ->whereNull('unblocked_at')
            ->update(['unblocked_at' => now()]);

        return response()->json(['message' => 'Member unblocked successfully']);
    }

    /**
     * Get member's enrollment status
     */
    public function getMemberEnrollments(int $memberId): JsonResponse
    {
        $actor = request()->user();

        if ($actor->role === 'member') {
            $ownsMemberProfile = DB::table('members')
                ->where('id', $memberId)
                ->where('user_id', $actor->id)
                ->exists();

            if (!$ownsMemberProfile) {
                return response()->json(['message' => 'You can only view your own enrollments'], 403);
            }
        }

        $enrollments = ClassEnrollment::where('member_id', $memberId)
            ->join('classes', 'class_enrollments.class_id', '=', 'classes.id')
            ->leftJoin('coaches', 'classes.coach_id', '=', 'coaches.id')
            ->leftJoin('users as coach_users', 'coaches.user_id', '=', 'coach_users.id')
            ->leftJoin('branches', 'classes.branch_id', '=', 'branches.id')
            ->select([
                'class_enrollments.id',
                'class_enrollments.attended',
                'class_enrollments.enrolled_at as enrolledAt',
                'classes.id as classId',
                'classes.title',
                'classes.class_date as classDate',
                'classes.start_time as startTime',
                'classes.end_time as endTime',
                'coach_users.name as coachName',
                'branches.name as branchName',
            ])
            ->orderBy('classes.class_date', 'desc')
            ->get();

        return response()->json($enrollments);
    }
}
