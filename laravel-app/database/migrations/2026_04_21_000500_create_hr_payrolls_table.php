<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_payrolls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coach_id')->constrained('coaches')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('base_salary', 10, 2)->default(0);
            $table->decimal('bonus', 10, 2)->default(0);
            $table->decimal('commission_rate', 10, 2)->default(0);
            $table->unsignedInteger('class_sessions_count')->default(0);
            $table->unsignedInteger('pt_sessions_count')->default(0);
            $table->unsignedInteger('commission_items_count')->default(0);
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->enum('status', ['pending', 'paid'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['coach_id', 'period_start', 'period_end'], 'hr_payrolls_unique_period');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_payrolls');
    }
};
