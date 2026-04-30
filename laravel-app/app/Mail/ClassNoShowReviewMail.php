<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClassNoShowReviewMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $memberName,
        public string $classTitle,
        public string $classDate,
        public string $startTime,
        public string $branchName,
        public int $noShowCount = 1,
        public bool $isBlocked = false,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->isBlocked ? 'Class Enrollment Blocked' : 'Class Attendance Review',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.class-no-show-review',
            text: 'emails.class-no-show-review-text',
        );
    }
}
