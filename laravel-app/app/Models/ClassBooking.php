<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassBooking extends Model
{
    use HasFactory;

    protected $table = 'class_bookings';
    public $timestamps = false;

    protected $fillable = [
        'class_id',
        'member_id',
        'booking_type',
        'subscription_id',
        'payment_id',
        'waitlist_position',
        'restricted_until',
        'cancellation_reason',
        'attendance_marked_at',
        'status',
    ];

    protected $casts = [
        'booked_at' => 'datetime',
        'restricted_until' => 'datetime',
        'attendance_marked_at' => 'datetime',
    ];
}
