<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            ContactMessage::query()->orderByDesc('created_at')->get()
        );
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $message = ContactMessage::query()->find($id);
        if (!$message) {
            return response()->json(['message' => 'Contact message not found'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['new', 'reviewed', 'closed'])],
        ]);

        $message->status = $validated['status'];
        $message->save();
        return response()->json($message->fresh());
    }
}
