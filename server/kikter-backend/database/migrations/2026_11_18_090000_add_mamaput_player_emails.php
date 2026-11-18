<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mamaput_players', fn (Blueprint $t) => $t->timestamp('email_opted_out_at')->nullable());
        Schema::create('mamaput_player_emails', function (Blueprint $t) {
            $t->id();
            $t->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $t->string('dedupe_key', 64)->unique();
            $t->string('kind', 16);
            $t->string('recipient', 190);
            $t->json('payload');
            $t->string('status', 16)->default('pending');
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->timestamp('available_at');
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_player_emails');
        Schema::table('mamaput_players', fn (Blueprint $t) => $t->dropColumn('email_opted_out_at'));
    }
};
