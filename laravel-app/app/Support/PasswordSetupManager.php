<?php

namespace App\Support;

use App\Mail\MemberPasswordSetupMail;
use App\Mail\MemberTemporaryPasswordMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordSetupManager
{
    public function issueFor(User $user): string
    {
        $plainToken = Str::random(64);

        $user->forceFill([
            'must_change_password' => true,
            'password_setup_token' => hash('sha256', $plainToken),
            'password_setup_token_expires_at' => now()->addDay(),
        ])->save();

        return $plainToken;
    }

    public function sendFor(User $user, ?string $plainToken = null): string
    {
        $plainToken ??= $this->issueFor($user);

        $frontendUrl = rtrim((string) env('FRONTEND_URL', config('app.url')), '/');
        $setupUrl = $frontendUrl . '/account-access?token=' . urlencode($plainToken) . '&email=' . urlencode($user->email);

        Mail::to($user->email)->send(new MemberPasswordSetupMail(
            memberName: (string) ($user->name ?: 'Member'),
            setupUrl: $setupUrl,
        ));

        return $plainToken;
    }

    public function createTemporaryPassword(int $length = 12): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        $specials = '!@#$%^&*';

        return
            $alphabet[random_int(0, strlen($alphabet) - 1)] .
            strtoupper($alphabet[random_int(0, strlen($alphabet) - 1)]) .
            random_int(0, 9) .
            $specials[random_int(0, strlen($specials) - 1)] .
            Str::random(max($length - 4, 8));
    }

    public function sendTemporaryPassword(User $user, string $temporaryPassword): void
    {
        Mail::to($user->email)->send(new MemberTemporaryPasswordMail(
            memberName: (string) ($user->name ?: 'Member'),
            temporaryPassword: $temporaryPassword,
        ));
    }
}
