<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Leaderboard numbers for the side games: the best Okada Rush endless run
     * (orders delivered) and the furthest Market Match level cleared.
     */
    public function up(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->unsignedInteger('okada_best')->default(0)->index();
            $table->unsignedInteger('match_level')->default(0)->index();
        });
    }

    public function down(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->dropIndex(['okada_best']);
            $table->dropIndex(['match_level']);
            $table->dropColumn(['okada_best', 'match_level']);
        });
    }
};
