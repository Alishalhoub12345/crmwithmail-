<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class AuthController extends Controller
{
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
