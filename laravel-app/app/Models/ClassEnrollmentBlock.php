<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassEnrollmentBlock extends Model
{
    protected $fillable = ['member_id', 'reason', 'blocked_by', 'blocked_at', 'unblocked_at'];
    protected $casts = ['blocked_at' => 'datetime', 'unblocked_at' => 'datetime'];

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function blockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }
}
