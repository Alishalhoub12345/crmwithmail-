<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return new JsonResponse(['message' => 'Authentication required'], 401);
        }

        $token = substr($authHeader, 7);
        $secret = $this->jwtSigningKey();

        try {
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (\Throwable $e) {
            return new JsonResponse(['message' => 'Invalid or expired token'], 401);
        }

        $user = User::query()->find($decoded->id ?? 0);
        if (!$user) {
            return new JsonResponse(['message' => 'User not found'], 404);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }

    private function jwtSigningKey(): string
    {
        $secret = (string) env('SESSION_SECRET', env('APP_KEY', 'gym-crm-jwt-secret-key'));

        return hash('sha256', $secret);
    }
}
