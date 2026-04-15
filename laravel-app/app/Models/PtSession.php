<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PtSession extends Model
{
    use HasFactory;

    protected $table = 'pt_sessions';
    public $timestamps = false;

    protected $fillable = [
        'member_id',
        'coach_id',
        'branch_id',
        'subscription_id',
        'session_date',
        'start_time',
        'end_time',
        'status',
        'notes',
        'cancellation_reason',
        'canceled_at',
        'completed_at',
        'created_by',
    ];

    protected $casts = [
        'session_date' => 'date',
        'canceled_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
