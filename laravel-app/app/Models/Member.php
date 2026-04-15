<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Member extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'branch_id',
        'primary_package_id',
        'first_name',
        'middle_name',
        'last_name',
        'membership_number',
        'unique_id',
        'gender',
        'birth_date',
        'nationality',
        'emergency_contact',
        'emergency_contact_name',
        'emergency_contact_phone',
        'join_date',
        'status',
        'is_frozen',
        'freeze_start_date',
        'freeze_end_date',
        'freeze_notes',
        'notes',
        'height',
        'weight',
        'fitness_goal',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'join_date' => 'date',
        'freeze_start_date' => 'date',
        'freeze_end_date' => 'date',
        'is_frozen' => 'boolean',
        'height' => 'decimal:2',
        'weight' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
