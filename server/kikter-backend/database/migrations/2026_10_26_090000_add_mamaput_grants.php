<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When the Mama Put game applied an item bought on Lagos Life to the
     * player's save (coins are applied by the server straight away).
     */
    public function up(): void
    {
        Schema::table('vatar_purchases', function (Blueprint $table) {
            $table->timestamp('applied_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vatar_purchases', function (Blueprint $table) {
            $table->dropColumn('applied_at');
        });
    }
};
