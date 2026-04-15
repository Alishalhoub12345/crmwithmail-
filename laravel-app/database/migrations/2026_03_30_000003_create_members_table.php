<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->unsignedBigInteger('primary_package_id')->nullable();
            $table->string('membership_number', 100)->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('birth_date')->nullable();
            $table->string('emergency_contact')->nullable();
            $table->date('join_date')->nullable();
            $table->enum('status', ['active', 'expired', 'frozen'])->default('active');
            $table->text('notes')->nullable();
            $table->decimal('height', 10, 2)->nullable();
            $table->decimal('weight', 10, 2)->nullable();
            $table->text('fitness_goal')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
