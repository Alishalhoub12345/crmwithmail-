<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassEnrollment extends Model
{
    protected $fillable = ['member_id', 'class_id', 'enrolled_at', 'attended'];

    protected $casts = [
        'attended' => 'boolean',
        'enrolled_at' => 'datetime',
    ];

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(GymClass::class, 'class_id');
    }
}
