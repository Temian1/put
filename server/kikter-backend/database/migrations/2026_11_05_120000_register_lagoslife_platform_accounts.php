<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // SQLite rebuilds users to change nullability. Its foreign-key pragma
    // cannot change inside a transaction; otherwise SET NULL cascades fire.
    public $withinTransaction = false;

    public function up(): void
    {
        $this->requireSafeTransactionState();
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
        Schema::table('vatar_players', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        $this->requireSafeTransactionState();
        if (Illuminate\Support\Facades\DB::table('users')->whereNull('email')->exists()) {
            throw new RuntimeException('Email-less platform accounts must be resolved before rolling back.');
        }
        Schema::table('vatar_players', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }

    private function requireSafeTransactionState(): void
    {
        $db = Illuminate\Support\Facades\DB::connection();
        if ($db->getDriverName() === 'sqlite' && $db->transactionLevel() > 0) {
            throw new RuntimeException('Run this SQLite schema migration outside a transaction to preserve account links.');
        }
    }
};
