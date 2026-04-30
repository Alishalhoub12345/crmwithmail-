<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('class_enrollment_blocks')) {
            return;
        }

        Schema::create('class_enrollment_blocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->string('reason')->default('excessive_no_shows'); // excessive_no_shows, other
            $table->unsignedBigInteger('blocked_by')->nullable(); // user who blocked (owner)
            $table->timestamp('blocked_at')->useCurrent();
            $table->timestamp('unblocked_at')->nullable();
            $table->timestamps();
            $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
            $table->foreign('blocked_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('class_enrollment_blocks');
    }
};
