<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('primary_package_id');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('unique_id', 100)->nullable()->unique()->after('membership_number');
            $table->string('nationality', 100)->nullable()->after('gender');
            $table->string('emergency_contact_name')->nullable()->after('nationality');
            $table->string('emergency_contact_phone')->nullable()->after('emergency_contact_name');
            $table->boolean('is_frozen')->default(false)->after('status');
            $table->date('freeze_start_date')->nullable()->after('is_frozen');
            $table->date('freeze_end_date')->nullable()->after('freeze_start_date');
            $table->text('freeze_notes')->nullable()->after('freeze_end_date');
        });

        Schema::table('packages', function (Blueprint $table) {
            $table->enum('package_type', ['membership', 'personal_training', 'hybrid'])->default('membership')->after('name');
            $table->integer('included_pt_sessions')->default(0)->after('total_classes');
            $table->boolean('allows_freeze')->default(false)->after('included_pt_sessions');
            $table->integer('freeze_days_allowed')->default(0)->after('allows_freeze');
            $table->boolean('auto_renew')->default(false)->after('freeze_days_allowed');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->integer('pt_sessions_total')->default(0)->after('remaining_classes');
            $table->integer('pt_sessions_used')->default(0)->after('pt_sessions_total');
            $table->boolean('is_frozen')->default(false)->after('pt_sessions_used');
            $table->date('freeze_start_date')->nullable()->after('is_frozen');
            $table->date('freeze_end_date')->nullable()->after('freeze_start_date');
            $table->integer('freeze_days_used')->default(0)->after('freeze_end_date');
            $table->unsignedBigInteger('renewed_from_subscription_id')->nullable()->after('freeze_days_used');
            $table->timestamp('renewed_at')->nullable()->after('renewed_from_subscription_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE subscriptions MODIFY status ENUM('active', 'expired', 'canceled', 'frozen') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn([
                'pt_sessions_total',
                'pt_sessions_used',
                'is_frozen',
                'freeze_start_date',
                'freeze_end_date',
                'freeze_days_used',
                'renewed_from_subscription_id',
                'renewed_at',
            ]);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE subscriptions MODIFY status ENUM('active', 'expired', 'canceled') NOT NULL DEFAULT 'active'");
        }

        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn([
                'package_type',
                'included_pt_sessions',
                'allows_freeze',
                'freeze_days_allowed',
                'auto_renew',
            ]);
        });

        Schema::table('members', function (Blueprint $table) {
            $table->dropUnique(['unique_id']);
            $table->dropColumn([
                'first_name',
                'last_name',
                'unique_id',
                'nationality',
                'emergency_contact_name',
                'emergency_contact_phone',
                'is_frozen',
                'freeze_start_date',
                'freeze_end_date',
                'freeze_notes',
            ]);
        });
    }
};
