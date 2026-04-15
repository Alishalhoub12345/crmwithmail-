<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeadTask extends Model
{
    use HasFactory;

    protected $table = 'lead_tasks';
    public $timestamps = false;

    protected $fillable = [
        'lead_id',
        'assigned_to',
        'due_date',
        'status',
        'note',
    ];

    protected $casts = [
        'due_date' => 'date',
        'created_at' => 'datetime',
    ];
}
