<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('coach_id')->nullable()->constrained('coaches')->nullOnDelete();
            $table->date('class_date');
            $table->string('start_time', 32);
            $table->string('end_time', 32);
            $table->integer('capacity');
            $table->decimal('price_extra', 10, 2)->nullable();
            $table->boolean('requires_extra_payment')->default(false)->nullable();
            $table->enum('status', ['scheduled', 'canceled', 'completed'])->default('scheduled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
