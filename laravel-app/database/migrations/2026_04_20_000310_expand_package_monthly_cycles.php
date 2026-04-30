<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_day', '1_week', '2_weeks', '1_month', '2_months', '3_months', '4_months', '5_months', '6_months', '1_year') NOT NULL DEFAULT '1_month'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_day', '1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year') NOT NULL DEFAULT '1_month'");
    }
};
