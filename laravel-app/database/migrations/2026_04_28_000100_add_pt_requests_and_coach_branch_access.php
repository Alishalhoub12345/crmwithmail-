<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coach_branch_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coach_id')->constrained('coaches')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->unique(['coach_id', 'branch_id']);
        });

        $coachRows = DB::table('coaches')
            ->whereNotNull('branch_id')
            ->select(['id', 'branch_id'])
            ->get();

        foreach ($coachRows as $row) {
            DB::table('coach_branch_access')->insertOrIgnore([
                'coach_id' => $row->id,
                'branch_id' => $row->branch_id,
            ]);
        }

        DB::statement("ALTER TABLE pt_sessions MODIFY status ENUM('pending', 'scheduled', 'completed', 'canceled', 'late_canceled', 'no_show') NOT NULL DEFAULT 'scheduled'");
    }

    public function down(): void
    {
        DB::table('pt_sessions')
            ->where('status', 'pending')
            ->update(['status' => 'canceled']);

        DB::statement("ALTER TABLE pt_sessions MODIFY status ENUM('scheduled', 'completed', 'canceled', 'late_canceled', 'no_show') NOT NULL DEFAULT 'scheduled'");

        Schema::dropIfExists('coach_branch_access');
    }
};
