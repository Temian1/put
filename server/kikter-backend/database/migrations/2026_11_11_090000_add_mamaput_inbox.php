<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The in-game inbox: admin announcements (with optional coin rewards),
     * "someone passed you" alerts, short rival messages and mutes.
     */
    public function up(): void
    {
        Schema::create('mamaput_announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 100);
            $table->text('body');
            // all, lagoslife or player (one player).
            $table->string('audience', 12)->default('all');
            $table->foreignId('player_id')->nullable()->constrained('mamaput_players')->nullOnDelete();
            $table->unsignedInteger('reward_coins')->default(0);
            $table->boolean('emailed')->default(false);
            $table->unsignedInteger('sent_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('mamaput_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            // announcement, passed, message or support.
            $table->string('type', 16);
            $table->string('title', 150);
            $table->text('body');
            $table->foreignId('from_player_id')->nullable()->constrained('mamaput_players')->nullOnDelete();
            $table->foreignId('announcement_id')->nullable()->constrained('mamaput_announcements')->cascadeOnDelete();
            $table->unsignedInteger('reward_coins')->default(0);
            // Keeps "passed" alerts to one per board per day.
            $table->string('ref', 60)->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();
            $table->index(['player_id', 'read_at']);
            $table->index(['player_id', 'ref']);
            $table->index(['type', 'created_at']);
        });

        Schema::create('mamaput_mutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->foreignId('muted_player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['player_id', 'muted_player_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_mutes');
        Schema::dropIfExists('mamaput_notifications');
        Schema::dropIfExists('mamaput_announcements');
    }
};
