<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use App\Support\PasswordSetupManager;
use RuntimeException;

class AuthController extends Controller
{
    private const PASSWORD_RESET_EMAILS_PER_DAY = 3;

    public function __construct(
        private readonly PasswordSetupManager $passwordSetupManager,
    ) {
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (!$user || !$this->passwordMatches($validated['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'Account is not active'], 403);
        }

        if ($user->must_change_password) {
            return response()->json([
                'message' => 'You must set a new password before logging in.',
                'passwordSetupRequired' => true,
            ], 403);
        }

        $jwtKey = $this->jwtSigningKey();

        $token = JWT::encode([
            'id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'branchId' => $user->branch_id,
            'iat' => time(),
            'exp' => time() + (7 * 24 * 60 * 60),
        ], $jwtKey, 'HS256');

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'branchId' => $user->branch_id,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'branchId' => $user->branch_id,
            'status' => $user->status,
        ]);
    }

    public function validatePasswordSetup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string', 'min:20'],
        ]);

        $user = User::query()
            ->where('email', $validated['email'])
            ->first();

        if (
            !$user
            || !$user->must_change_password
            || !$user->password_setup_token
            || !hash_equals($user->password_setup_token, hash('sha256', $validated['token']))
            || !$user->password_setup_token_expires_at
            || $user->password_setup_token_expires_at->isPast()
        ) {
            return response()->json(['message' => 'This password setup link is invalid or expired.'], 422);
        }

        return response()->json([
            'email' => $user->email,
            'name' => $user->name,
        ]);
    }

    public function completePasswordSetup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string', 'min:20'],
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'passwordConfirmation' => ['required', 'same:password'],
        ]);

        $user = User::query()
            ->where('email', $validated['email'])
            ->first();

        if (
            !$user
            || !$user->must_change_password
            || !$user->password_setup_token
            || !hash_equals($user->password_setup_token, hash('sha256', $validated['token']))
            || !$user->password_setup_token_expires_at
            || $user->password_setup_token_expires_at->isPast()
        ) {
            return response()->json(['message' => 'This password setup link is invalid or expired.'], 422);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => false,
            'password_setup_token' => null,
            'password_setup_token_expires_at' => null,
        ])->save();

        return response()->json([
            'message' => 'Password updated successfully. You can now log in.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()
            ->where('email', $validated['email'])
            ->where('role', 'member')
            ->first();

        if (!$user) {
            return response()->json(['message' => 'If the account exists, a password setup link has been sent.']);
        }

        $rateLimitKey = $this->passwordResetRateLimitKey($user->email);

        if (!RateLimiter::tooManyAttempts($rateLimitKey, self::PASSWORD_RESET_EMAILS_PER_DAY)) {
            RateLimiter::hit($rateLimitKey, $this->secondsUntilEndOfDay());
            $this->passwordSetupManager->sendFor($user);
        }

        return response()->json([
            'message' => 'If the account exists, a password setup link has been sent.',
        ]);
    }

    private function passwordResetRateLimitKey(string $email): string
    {
        return 'member-password-reset:' . sha1(strtolower(trim($email))) . ':' . now()->toDateString();
    }

    private function secondsUntilEndOfDay(): int
    {
        return max(1, (int) now()->diffInSeconds(now()->copy()->endOfDay()));
    }

    private function passwordMatches(string $plainPassword, ?string $storedPassword): bool
    {
        if (!$storedPassword) {
            return false;
        }

        if ($this->looksLikeLegacyNodeScryptHash($storedPassword)) {
            return false;
        }

        try {
            return Hash::check($plainPassword, $storedPassword);
        } catch (RuntimeException) {
            return false;
        }
    }

    private function looksLikeLegacyNodeScryptHash(string $storedPassword): bool
    {
        return (bool) preg_match('/^[a-f0-9]{128}\.[a-f0-9]{32}$/i', $storedPassword);
    }

    private function jwtSigningKey(): string
    {
        $secret = (string) env('SESSION_SECRET', env('APP_KEY', 'gym-crm-jwt-secret-key'));

        return hash('sha256', $secret);
    }
}
