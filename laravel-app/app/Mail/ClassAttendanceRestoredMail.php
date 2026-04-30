<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClassAttendanceRestoredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $memberName,
        public string $classTitle,
        public string $classDate,
        public string $startTime,
        public string $branchName,
        public int $noShowCount,
        public bool $isBlocked,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Class Attendance Updated',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.class-attendance-restored',
            text: 'emails.class-attendance-restored-text',
        );
    }
}
