<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->unsignedTinyInteger('free_months')->default(0)->after('duration_days');
            $table->json('selected_class_credits')->nullable()->after('selected_class_titles');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->json('remaining_class_credits')->nullable()->after('remaining_classes');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('remaining_class_credits');
        });

        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn([
                'free_months',
                'selected_class_credits',
            ]);
        });
    }
};
