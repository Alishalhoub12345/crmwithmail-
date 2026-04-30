<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_branch_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->unique(['member_id', 'branch_id']);
        });

        Schema::create('package_branch_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained('packages')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->unique(['package_id', 'branch_id']);
        });

        $memberRows = DB::table('members')
            ->whereNotNull('branch_id')
            ->select('id', 'branch_id')
            ->get();

        foreach ($memberRows as $row) {
            DB::table('member_branch_access')->insertOrIgnore([
                'member_id' => $row->id,
                'branch_id' => $row->branch_id,
            ]);
        }

        $packageRows = DB::table('packages')
            ->whereNotNull('branch_id')
            ->select('id', 'branch_id')
            ->get();

        foreach ($packageRows as $row) {
            DB::table('package_branch_access')->insertOrIgnore([
                'package_id' => $row->id,
                'branch_id' => $row->branch_id,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('package_branch_access');
        Schema::dropIfExists('member_branch_access');
    }
};
