<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained('subscriptions')->nullOnDelete();
            $table->foreignId('class_booking_id')->nullable()->constrained('class_bookings')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->enum('payment_type', ['package_purchase', 'class_extra', 'product_purchase', 'other']);
            $table->enum('payment_method', ['cash', 'card', 'online']);
            $table->enum('status', ['pending', 'paid', 'failed', 'refunded'])->default('paid');
            $table->string('transaction_ref')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable()->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
