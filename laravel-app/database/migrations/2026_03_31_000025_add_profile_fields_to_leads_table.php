<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('unique_id', 100)->nullable()->after('email');
            $table->enum('gender', ['male', 'female', 'other'])->nullable()->after('unique_id');
            $table->date('birth_date')->nullable()->after('gender');
            $table->string('nationality', 100)->nullable()->after('birth_date');
            $table->string('emergency_contact_name')->nullable()->after('nationality');
            $table->string('emergency_contact_phone', 100)->nullable()->after('emergency_contact_name');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn([
                'first_name',
                'last_name',
                'unique_id',
                'gender',
                'birth_date',
                'nationality',
                'emergency_contact_name',
                'emergency_contact_phone',
            ]);
        });
    }
};
