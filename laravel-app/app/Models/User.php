<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'password',
        'role',
        'branch_id',
        'phone',
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
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'birth_date' => 'date',
        'is_frozen' => 'boolean',
        'freeze_start_date' => 'date',
        'freeze_end_date' => 'date',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
