<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return new JsonResponse(['message' => 'Authentication required'], 401);
        }

        if (!in_array($user->role, $roles, true)) {
            return new JsonResponse(['message' => 'Access denied'], 403);
        }

        return $next($request);
    }
}
