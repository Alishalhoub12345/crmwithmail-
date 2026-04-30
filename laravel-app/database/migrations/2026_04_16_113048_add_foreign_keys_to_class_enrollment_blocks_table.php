<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('class_enrollment_blocks')) {
            return;
        }

        $existingForeignKeys = collect(DB::select("
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'class_enrollment_blocks'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        "))->pluck('CONSTRAINT_NAME')->all();

        Schema::table('class_enrollment_blocks', function (Blueprint $table) use ($existingForeignKeys) {
            if (!in_array('class_enrollment_blocks_member_id_foreign', $existingForeignKeys, true)) {
                $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
            }

            if (!in_array('class_enrollment_blocks_blocked_by_foreign', $existingForeignKeys, true)) {
                $table->foreign('blocked_by')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('class_enrollment_blocks')) {
            return;
        }

        $existingForeignKeys = collect(DB::select("
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'class_enrollment_blocks'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        "))->pluck('CONSTRAINT_NAME')->all();

        Schema::table('class_enrollment_blocks', function (Blueprint $table) use ($existingForeignKeys) {
            if (in_array('class_enrollment_blocks_member_id_foreign', $existingForeignKeys, true)) {
                $table->dropForeign('class_enrollment_blocks_member_id_foreign');
            }

            if (in_array('class_enrollment_blocks_blocked_by_foreign', $existingForeignKeys, true)) {
                $table->dropForeign('class_enrollment_blocks_blocked_by_foreign');
            }
        });
    }
};
