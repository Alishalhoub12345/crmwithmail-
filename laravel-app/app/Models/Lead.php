<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'branch_id',
        'name',
        'first_name',
        'last_name',
        'phone',
        'email',
        'unique_id',
        'gender',
        'birth_date',
        'nationality',
        'emergency_contact_name',
        'emergency_contact_phone',
        'is_frozen',
        'freeze_start_date',
        'freeze_end_date',
        'freeze_notes',
        'source',
        'status',
        'assigned_to',
        'notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'birth_date' => 'date',
        'is_frozen' => 'boolean',
        'freeze_start_date' => 'date',
        'freeze_end_date' => 'date',
    ];
}
