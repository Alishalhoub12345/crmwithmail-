<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GymPackage extends Model
{
    use HasFactory;

    protected $table = 'packages';
    public $timestamps = false;

    protected $fillable = [
        'name',
        'package_type',
        'tier',
        'billing_cycle',
        'description',
        'price',
        'duration_days',
        'free_months',
        'branch_id',
        'gym_access_hours',
        'coach_hours',
        'dietitian_hours',
        'allows_all_branches',
        'sessions_per_week',
        'total_classes',
        'included_pt_sessions',
        'allows_freeze',
        'freeze_days_allowed',
        'auto_renew',
        'includes_gym_access',
        'includes_classes',
        'selected_class_ids',
        'selected_class_titles',
        'selected_class_credits',
        'status',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'allows_all_branches' => 'boolean',
        'allows_freeze' => 'boolean',
        'auto_renew' => 'boolean',
        'includes_gym_access' => 'boolean',
        'includes_classes' => 'boolean',
        'selected_class_ids' => 'array',
        'selected_class_titles' => 'array',
        'selected_class_credits' => 'array',
    ];
}
