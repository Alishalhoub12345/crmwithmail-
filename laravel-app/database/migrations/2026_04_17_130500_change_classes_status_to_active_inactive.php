<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE classes MODIFY status ENUM('scheduled', 'canceled', 'completed', 'active', 'inactive') NOT NULL DEFAULT 'scheduled'");
        DB::statement("UPDATE classes SET status = 'active' WHERE status = 'scheduled'");
        DB::statement("UPDATE classes SET status = 'inactive' WHERE status IN ('canceled', 'completed')");
        DB::statement("ALTER TABLE classes MODIFY status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE classes MODIFY status ENUM('scheduled', 'canceled', 'completed') NOT NULL DEFAULT 'scheduled'");
        DB::statement("UPDATE classes SET status = 'scheduled' WHERE status = 'active'");
        DB::statement("UPDATE classes SET status = 'canceled' WHERE status = 'inactive'");
    }
};
