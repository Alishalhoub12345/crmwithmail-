<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            if (!Schema::hasColumn('packages', 'free_trial_days')) {
                $table->unsignedSmallInteger('free_trial_days')->default(0)->after('free_months');
            }
        });

        DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_day', '1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year') NOT NULL DEFAULT '1_month'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_month', '3_months', '6_months', '1_year') NOT NULL DEFAULT '1_month'");

        Schema::table('packages', function (Blueprint $table) {
            if (Schema::hasColumn('packages', 'free_trial_days')) {
                $table->dropColumn('free_trial_days');
            }
        });
    }
};
