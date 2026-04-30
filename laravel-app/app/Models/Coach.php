<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Coach extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'branch_id',
        'role_title',
        'specialization',
        'salary',
        'commission_rate',
        'bonus',
        'picture_path',
        'certification_files',
        'document_files',
        'certification_expiry_date',
        'legal_files',
        'vacation_days_allowed',
        'vacation_days_taken',
        'hire_date',
        'end_date',
        'status',
        'bio',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'end_date' => 'date',
        'certification_expiry_date' => 'date',
        'salary' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'bonus' => 'decimal:2',
        'certification_files' => 'array',
        'document_files' => 'array',
        'legal_files' => 'array',
        'vacation_days_allowed' => 'integer',
        'vacation_days_taken' => 'integer',
    ];

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'coach_branch_access');
    }
}
