<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (!Schema::hasColumn('branches', 'secondary_phone')) {
                $table->string('secondary_phone', 50)->nullable()->after('phone');
            }

            if (!Schema::hasColumn('branches', 'mobile')) {
                $table->string('mobile', 50)->nullable()->after('secondary_phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (Schema::hasColumn('branches', 'mobile')) {
                $table->dropColumn('mobile');
            }

            if (Schema::hasColumn('branches', 'secondary_phone')) {
                $table->dropColumn('secondary_phone');
            }
        });
    }
};
