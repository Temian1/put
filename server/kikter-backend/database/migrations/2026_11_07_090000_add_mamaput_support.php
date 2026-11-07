<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A contact email the player types in the game (unverified, so it is kept
     * apart from the login email on users) and support tickets.
     */
    public function up(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->string('contact_email', 190)->nullable();
        });

        Schema::create('mamaput_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->string('category', 20);
            $table->string('status', 12)->default('open');
            // The player has a reply they have not opened yet.
            $table->boolean('unread')->default(false);
            $table->timestamps();
            $table->index(['status', 'updated_at']);
            $table->index(['player_id', 'status']);
        });

        Schema::create('mamaput_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('mamaput_tickets')->cascadeOnDelete();
            // The admin who answered; null means the player wrote it.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('from_support')->default(false);
            $table->text('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_ticket_messages');
        Schema::dropIfExists('mamaput_tickets');
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->dropColumn('contact_email');
        });
    }
};
