<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'branch_id',
        'name',
        'description',
        'price',
        'stock_qty',
        'image_url',
        'category',
        'status',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];
}
