<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('tier', ['bronze', 'silver', 'gold'])->default('bronze');
            $table->enum('billing_cycle', ['1_month', '3_months', '1_year'])->default('1_month');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->integer('duration_days');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->integer('gym_access_hours')->nullable();
            $table->integer('coach_hours')->default(0)->nullable();
            $table->integer('dietitian_hours')->default(0)->nullable();
            $table->boolean('allows_all_branches')->default(false)->nullable();
            $table->integer('sessions_per_week')->nullable();
            $table->integer('total_classes')->nullable();
            $table->boolean('includes_gym_access')->default(true)->nullable();
            $table->boolean('includes_classes')->default(true)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
