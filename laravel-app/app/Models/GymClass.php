<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GymClass extends Model
{
    use HasFactory;

    protected $table = 'classes';
    public $timestamps = false;

    protected $fillable = [
        'branch_id',
        'title',
        'description',
        'coach_id',
        'class_date',
        'start_time',
        'end_time',
        'capacity',
        'price',
        'price_type',
        'enable_waitlist',
        'price_extra',
        'requires_extra_payment',
        'status',
        'cancellation_reason',
        'canceled_at',
    ];

    protected $casts = [
        'class_date' => 'date',
        'price' => 'decimal:2',
        'price_extra' => 'decimal:2',
        'enable_waitlist' => 'boolean',
        'requires_extra_payment' => 'boolean',
        'canceled_at' => 'datetime',
    ];
}
