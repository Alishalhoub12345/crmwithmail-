<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'is_frozen',
                'freeze_start_date',
                'freeze_end_date',
                'freeze_notes',
            ]);
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn([
                'is_frozen',
                'freeze_start_date',
                'freeze_end_date',
                'freeze_notes',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_frozen')->default(false)->after('emergency_contact_phone');
            $table->date('freeze_start_date')->nullable()->after('is_frozen');
            $table->date('freeze_end_date')->nullable()->after('freeze_start_date');
            $table->text('freeze_notes')->nullable()->after('freeze_end_date');
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->boolean('is_frozen')->default(false)->after('emergency_contact_phone');
            $table->date('freeze_start_date')->nullable()->after('is_frozen');
            $table->date('freeze_end_date')->nullable()->after('freeze_start_date');
            $table->text('freeze_notes')->nullable()->after('freeze_end_date');
        });
    }
};
