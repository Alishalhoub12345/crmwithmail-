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
            $table->json('selected_class_titles')->nullable()->after('selected_class_ids');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_month', '3_months', '6_months', '1_year') NOT NULL DEFAULT '1_month'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE packages MODIFY billing_cycle ENUM('1_month', '3_months', '1_year') NOT NULL DEFAULT '1_month'");
        }

        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn('selected_class_titles');
        });
    }
};
