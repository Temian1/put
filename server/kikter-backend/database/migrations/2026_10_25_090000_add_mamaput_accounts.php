<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mama Put accounts: sign-in tokens per device, Lagos Life links and the
     * coin wallet ledger.
     */
    public function up(): void
    {
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->foreignId('vatar_player_id')->nullable()->unique()->constrained()->nullOnDelete();
            // Coin wallet for players without a Kikter account (Lagos Life only).
            $table->unsignedBigInteger('wallet')->default(0);
        });

        Schema::create('mamaput_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamps();
        });

        Schema::create('mamaput_wallet_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('mamaput_players')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->integer('amount');
            $table->unsignedBigInteger('balance');
            $table->string('reason', 32);
            $table->string('ref', 100)->nullable();
            $table->timestamps();
            $table->index(['player_id', 'reason', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_wallet_logs');
        Schema::dropIfExists('mamaput_tokens');
        Schema::table('mamaput_players', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vatar_player_id');
            $table->dropColumn('wallet');
        });
    }
};
