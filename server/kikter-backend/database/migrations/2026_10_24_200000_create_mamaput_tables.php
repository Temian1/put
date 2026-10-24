<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mama Put Rush players (cloud save + leaderboard numbers) and their shifts.
     */
    public function up(): void
    {
        Schema::create('mamaput_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 40);
            $table->string('token_hash', 64)->unique();
            $table->json('save')->nullable();
            $table->unsignedInteger('save_version')->default(0);
            $table->unsignedBigInteger('coins')->default(0);
            $table->float('reputation')->default(50);
            $table->unsignedInteger('unlocked')->default(1);
            $table->unsignedInteger('stars')->default(0)->index();
            $table->unsignedBigInteger('lifetime_sales')->default(0)->index();
            $table->unsignedBigInteger('endless_best')->default(0)->index();
            $table->unsignedTinyInteger('tier')->default(0);
            $table->unsignedTinyInteger('restaurants')->default(1);
            $table->unsignedTinyInteger('staff_count')->default(0);
            $table->unsignedInteger('shifts_played')->default(0);
            $table->timestamp('banned_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('mamaput_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->string('mode', 10);
            $table->unsignedSmallInteger('level')->nullable();
            $table->boolean('won')->default(false);
            $table->unsignedSmallInteger('served')->default(0);
            $table->unsignedSmallInteger('lost')->default(0);
            $table->unsignedBigInteger('sales')->default(0);
            $table->bigInteger('cash')->default(0);
            $table->unsignedTinyInteger('stars')->default(0);
            $table->unsignedSmallInteger('duration')->default(0);
            $table->boolean('flagged')->default(false)->index();
            $table->timestamps();
            $table->index(['player_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_shifts');
        Schema::dropIfExists('mamaput_players');
    }
};
