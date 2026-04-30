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
        'must_change_password',
        'password_setup_token',
        'password_setup_token_expires_at',
        'role',
        'branch_id',
        'phone',
        'address',
        'unique_id',
        'gender',
        'birth_date',
        'nationality',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_email',
        'is_frozen',
        'freeze_start_date',
        'freeze_end_date',
        'freeze_notes',
        'status',
        'is_hidden_from_ui',
    ];

    protected $hidden = [
        'password',
        'password_setup_token',
        'remember_token',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'password_setup_token_expires_at' => 'datetime',
        'must_change_password' => 'boolean',
        'birth_date' => 'date',
        'is_frozen' => 'boolean',
        'freeze_start_date' => 'date',
        'freeze_end_date' => 'date',
        'is_hidden_from_ui' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
