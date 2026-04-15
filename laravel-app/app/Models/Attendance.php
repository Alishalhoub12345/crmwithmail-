<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'class_id',
        'member_id',
        'branch_id',
        'attendance_type',
        'checkin_source',
        'access_granted',
        'device_identifier',
        'marked_by',
        'notes',
    ];

    protected $casts = [
        'checkin_time' => 'datetime',
        'access_granted' => 'boolean',
    ];
}
