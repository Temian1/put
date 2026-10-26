<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VatarPurchase extends Model
{
    use HasFactory;

    protected $fillable = ['mode', 'game_id', 'purchase_id', 'vatar_player_id', 'product_id', 'skin', 'item', 'quantity', 'status', 'granted_at', 'delivered_at', 'applied_at'];

    protected function casts(): array
    {
        return ['granted_at' => 'datetime', 'delivered_at' => 'datetime', 'applied_at' => 'datetime'];
    }
}
