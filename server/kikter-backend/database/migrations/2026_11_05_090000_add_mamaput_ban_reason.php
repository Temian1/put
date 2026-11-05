<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Why a Mama Put player was banned, shown to admins.
     */
    public function up(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->string('ban_reason')->nullable()->after('banned_at');
        });
    }

    public function down(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->dropColumn('ban_reason');
        });
    }
};
