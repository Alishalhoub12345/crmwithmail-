<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('address')->nullable()->after('phone');
            $table->string('emergency_contact_email')->nullable()->after('emergency_contact_phone');
        });

        Schema::table('coaches', function (Blueprint $table) {
            $table->string('role_title')->nullable()->after('branch_id');
            $table->decimal('commission_rate', 10, 2)->nullable()->after('salary');
            $table->decimal('bonus', 10, 2)->nullable()->after('commission_rate');
            $table->string('picture_path')->nullable()->after('bonus');
            $table->json('certification_files')->nullable()->after('picture_path');
            $table->json('document_files')->nullable()->after('certification_files');
            $table->date('certification_expiry_date')->nullable()->after('document_files');
            $table->json('legal_files')->nullable()->after('certification_expiry_date');
            $table->unsignedInteger('vacation_days_allowed')->default(0)->after('legal_files');
            $table->unsignedInteger('vacation_days_taken')->default(0)->after('vacation_days_allowed');
        });
    }

    public function down(): void
    {
        Schema::table('coaches', function (Blueprint $table) {
            $table->dropColumn([
                'role_title',
                'commission_rate',
                'bonus',
                'picture_path',
                'certification_files',
                'document_files',
                'certification_expiry_date',
                'legal_files',
                'vacation_days_allowed',
                'vacation_days_taken',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'address',
                'emergency_contact_email',
            ]);
        });
    }
};
