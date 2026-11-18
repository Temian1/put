<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phone numbers players leave for the airtime draw, one per player.
     */
    public function up(): void
    {
        Schema::create('mamaput_airtime_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->unique()->constrained('mamaput_players')->cascadeOnDelete();
            $table->string('phone', 11);
            $table->string('network', 10);
            // The network our prefix table guessed, to spot ported numbers.
            $table->string('detected', 10)->nullable();
            $table->unsignedInteger('level_at_entry')->default(1);
            // pending, picked (won the draw), sent or rejected.
            $table->string('status', 10)->default('pending');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mamaput_airtime_entries');
    }
};
