<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Coach extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'branch_id',
        'specialization',
        'salary',
        'hire_date',
        'end_date',
        'status',
        'bio',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'end_date' => 'date',
        'salary' => 'decimal:2',
    ];
}
