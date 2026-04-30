<?php

namespace Tests\Feature;

use App\Http\Middleware\JwtAuthMiddleware;
use App\Mail\ClassAttendanceRestoredMail;
use App\Mail\ClassNoShowReviewMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ClassEnrollmentNoShowPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(JwtAuthMiddleware::class);
        $this->createSchema();
    }

    public function test_second_no_show_blocks_member_and_sends_block_notice(): void
    {
        Mail::fake();

        $memberUser = $this->createUser('member', 'Member One');
        $memberId = $this->createMember($memberUser);
        $coachUser = $this->createUser('coach', 'Coach One');
        $coachId = $this->createCoach($coachUser);
        $firstClassId = $this->createClass($coachId);
        $secondClassId = $this->createClass($coachId);
        $firstEnrollmentId = $this->createEnrollment($memberId, $firstClassId, true);
        $secondEnrollmentId = $this->createEnrollment($memberId, $secondClassId, true);

        $this->actingAs($coachUser)
            ->postJson('/api/class-enrollments/mark-attendance', [
                'enrollmentId' => $firstEnrollmentId,
                'attended' => false,
            ])
            ->assertOk();

        $this->assertDatabaseMissing('class_enrollment_blocks', [
            'member_id' => $memberId,
            'unblocked_at' => null,
        ]);
        Mail::assertSent(
            ClassNoShowReviewMail::class,
            fn (ClassNoShowReviewMail $mail) => !$mail->isBlocked && $mail->noShowCount === 1
        );

        $this->actingAs($coachUser)
            ->postJson('/api/class-enrollments/mark-attendance', [
                'enrollmentId' => $secondEnrollmentId,
                'attended' => false,
            ])
            ->assertOk();

        $this->assertDatabaseHas('class_enrollment_blocks', [
            'member_id' => $memberId,
            'reason' => 'excessive_no_shows',
            'blocked_by' => $coachUser->id,
            'unblocked_at' => null,
        ]);
        Mail::assertSent(
            ClassNoShowReviewMail::class,
            fn (ClassNoShowReviewMail $mail) => $mail->isBlocked && $mail->noShowCount === 2
        );
    }

    public function test_blocked_member_cannot_enroll_until_admin_unblocks_them(): void
    {
        $memberUser = $this->createUser('member', 'Member Two');
        $memberId = $this->createMember($memberUser);
        $adminUser = $this->createUser('admin', 'Front Desk');
        $classId = $this->createClass();

        DB::table('class_enrollment_blocks')->insert([
            'member_id' => $memberId,
            'reason' => 'excessive_no_shows',
            'blocked_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($memberUser)
            ->postJson('/api/class-enrollments/enroll', [
                'memberId' => $memberId,
                'classId' => $classId,
            ])
            ->assertForbidden()
            ->assertJson([
                'blocked' => true,
            ]);

        $this->actingAs($adminUser)
            ->postJson('/api/class-enrollment-blocks/unblock', [
                'memberId' => $memberId,
            ])
            ->assertOk();

        $this->actingAs($memberUser)
            ->postJson('/api/class-enrollments/enroll', [
                'memberId' => $memberId,
                'classId' => $classId,
            ])
            ->assertCreated();
    }

    public function test_member_cannot_enroll_when_class_capacity_is_full(): void
    {
        $firstMemberUser = $this->createUser('member', 'Member Three');
        $firstMemberId = $this->createMember($firstMemberUser);
        $secondMemberUser = $this->createUser('member', 'Member Four');
        $secondMemberId = $this->createMember($secondMemberUser);
        $classId = $this->createClass(capacity: 1);

        $this->createEnrollment($firstMemberId, $classId);

        $this->actingAs($secondMemberUser)
            ->postJson('/api/class-enrollments/enroll', [
                'memberId' => $secondMemberId,
                'classId' => $classId,
            ])
            ->assertUnprocessable()
            ->assertJson([
                'message' => 'Class is full',
            ]);
    }

    public function test_owner_can_change_no_show_to_attended_and_member_gets_current_absence_count(): void
    {
        Mail::fake();

        $memberUser = $this->createUser('member', 'Member Five');
        $memberId = $this->createMember($memberUser);
        $ownerUser = $this->createUser('owner', 'Owner One');
        $coachUser = $this->createUser('coach', 'Coach Two');
        $coachId = $this->createCoach($coachUser);
        $firstClassId = $this->createClass($coachId);
        $secondClassId = $this->createClass($coachId);
        $thirdClassId = $this->createClass($coachId);
        $firstEnrollmentId = $this->createEnrollment($memberId, $firstClassId, false);
        $this->createEnrollment($memberId, $secondClassId, false);
        $this->createEnrollment($memberId, $thirdClassId, false);

        DB::table('class_enrollment_blocks')->insert([
            'member_id' => $memberId,
            'reason' => 'excessive_no_shows',
            'blocked_by' => $coachUser->id,
            'blocked_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($ownerUser)
            ->postJson('/api/class-enrollments/mark-attendance', [
                'enrollmentId' => $firstEnrollmentId,
                'attended' => true,
            ])
            ->assertOk()
            ->assertJsonPath('enrollment.attended', true);

        $this->assertDatabaseHas('class_enrollment_blocks', [
            'member_id' => $memberId,
            'unblocked_at' => null,
        ]);
        Mail::assertSent(
            ClassAttendanceRestoredMail::class,
            fn (ClassAttendanceRestoredMail $mail) => $mail->isBlocked && $mail->noShowCount === 2
        );
    }

    public function test_coach_can_change_no_show_to_attended_and_member_gets_restored_notice(): void
    {
        Mail::fake();

        $memberUser = $this->createUser('member', 'Member Six');
        $memberId = $this->createMember($memberUser);
        $coachUser = $this->createUser('coach', 'Coach Three');
        $coachId = $this->createCoach($coachUser);
        $classId = $this->createClass($coachId);
        $enrollmentId = $this->createEnrollment($memberId, $classId, false);

        $this->actingAs($coachUser)
            ->postJson('/api/class-enrollments/mark-attendance', [
                'enrollmentId' => $enrollmentId,
                'attended' => true,
            ])
            ->assertOk()
            ->assertJsonPath('enrollment.attended', true);

        Mail::assertSent(
            ClassAttendanceRestoredMail::class,
            fn (ClassAttendanceRestoredMail $mail) => !$mail->isBlocked && $mail->noShowCount === 0
        );
    }

    private function createSchema(): void
    {
        foreach ([
            'class_enrollment_blocks',
            'class_enrollments',
            'classes',
            'coaches',
            'members',
            'users',
            'branches',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('branches', function ($table) {
            $table->id();
            $table->string('name')->nullable();
        });

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('role')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
        });

        Schema::create('members', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_frozen')->default(false);
        });

        Schema::create('coaches', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('branch_id')->nullable();
        });

        Schema::create('classes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->string('title');
            $table->unsignedBigInteger('coach_id')->nullable();
            $table->date('class_date');
            $table->string('start_time');
            $table->string('end_time');
            $table->integer('capacity');
            $table->string('status')->default('active');
        });

        Schema::create('class_enrollments', function ($table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->unsignedBigInteger('class_id');
            $table->timestamp('enrolled_at')->nullable();
            $table->boolean('attended')->nullable();
            $table->timestamps();
        });

        Schema::create('class_enrollment_blocks', function ($table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->string('reason')->default('excessive_no_shows');
            $table->unsignedBigInteger('blocked_by')->nullable();
            $table->timestamp('blocked_at')->nullable();
            $table->timestamp('unblocked_at')->nullable();
            $table->timestamps();
        });
    }

    private function createUser(string $role, string $name): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)) . '@example.test',
            'password' => 'password',
            'role' => $role,
            'branch_id' => 1,
        ]);
    }

    private function createMember(User $user): int
    {
        return (int) DB::table('members')->insertGetId([
            'user_id' => $user->id,
            'branch_id' => 1,
            'status' => 'active',
            'is_frozen' => false,
        ]);
    }

    private function createCoach(User $user): int
    {
        return (int) DB::table('coaches')->insertGetId([
            'user_id' => $user->id,
            'branch_id' => 1,
        ]);
    }

    private function createClass(?int $coachId = null, int $capacity = 10): int
    {
        return (int) DB::table('classes')->insertGetId([
            'branch_id' => 1,
            'title' => 'Boxing',
            'coach_id' => $coachId,
            'class_date' => now()->addDay()->toDateString(),
            'start_time' => '09:00',
            'end_time' => '10:00',
            'capacity' => $capacity,
            'status' => 'active',
        ]);
    }

    private function createEnrollment(int $memberId, int $classId, ?bool $attended = null): int
    {
        return (int) DB::table('class_enrollments')->insertGetId([
            'member_id' => $memberId,
            'class_id' => $classId,
            'enrolled_at' => now(),
            'attended' => $attended,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
