<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'member_id',
        'package_id',
        'start_date',
        'end_date',
        'remaining_classes',
        'remaining_class_credits',
        'pt_sessions_total',
        'pt_sessions_used',
        'is_frozen',
        'freeze_start_date',
        'freeze_end_date',
        'freeze_days_used',
        'renewed_from_subscription_id',
        'renewed_at',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'freeze_start_date' => 'date',
        'freeze_end_date' => 'date',
        'renewed_at' => 'datetime',
        'is_frozen' => 'boolean',
        'remaining_class_credits' => 'array',
        'created_at' => 'datetime',
    ];
}
