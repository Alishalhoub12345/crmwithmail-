<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            if (!Schema::hasColumn('members', 'manual_pt_credits_total')) {
                $table->integer('manual_pt_credits_total')->default(0)->after('fitness_goal');
            }

            if (!Schema::hasColumn('members', 'manual_pt_credits_used')) {
                $table->integer('manual_pt_credits_used')->default(0)->after('manual_pt_credits_total');
            }
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            if (Schema::hasColumn('members', 'manual_pt_credits_used')) {
                $table->dropColumn('manual_pt_credits_used');
            }

            if (Schema::hasColumn('members', 'manual_pt_credits_total')) {
                $table->dropColumn('manual_pt_credits_total');
            }
        });
    }
};
