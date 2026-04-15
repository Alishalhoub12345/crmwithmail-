<?php

use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

Route::get('/{any?}', function (): BinaryFileResponse {
    return response()->file(public_path('index.html'));
})->where('any', '^(?!api).*$');
