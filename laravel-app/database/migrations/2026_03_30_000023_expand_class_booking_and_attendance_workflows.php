<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->boolean('enable_waitlist')->default(true)->after('capacity');
            $table->text('cancellation_reason')->nullable()->after('status');
            $table->timestamp('canceled_at')->nullable()->after('cancellation_reason');
        });

        Schema::table('class_bookings', function (Blueprint $table) {
            $table->integer('waitlist_position')->nullable()->after('payment_id');
            $table->timestamp('restricted_until')->nullable()->after('waitlist_position');
            $table->text('cancellation_reason')->nullable()->after('restricted_until');
            $table->timestamp('attendance_marked_at')->nullable()->after('cancellation_reason');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE class_bookings MODIFY status ENUM('booked', 'waitlisted', 'attended', 'canceled', 'late_canceled', 'no_show') NOT NULL DEFAULT 'booked'");
        }

        Schema::table('attendance', function (Blueprint $table) {
            $table->enum('checkin_source', ['manual', 'face_device', 'system'])->default('manual')->after('attendance_type');
            $table->boolean('access_granted')->default(true)->after('checkin_source');
            $table->string('device_identifier')->nullable()->after('access_granted');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn(['checkin_source', 'access_granted', 'device_identifier']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE class_bookings MODIFY status ENUM('booked', 'attended', 'canceled') NOT NULL DEFAULT 'booked'");
        }

        Schema::table('class_bookings', function (Blueprint $table) {
            $table->dropColumn(['waitlist_position', 'restricted_until', 'cancellation_reason', 'attendance_marked_at']);
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn(['enable_waitlist', 'cancellation_reason', 'canceled_at']);
        });
    }
};
