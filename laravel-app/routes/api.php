<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ClassBookingController;
use App\Http\Controllers\Api\ClassEnrollmentController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ContactMessageController;
use App\Http\Controllers\Api\CoachController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DietPlanController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\GymClassController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\LeadTaskController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PtSessionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/password-setup/validate', [AuthController::class, 'validatePasswordSetup']);
    Route::post('/password-setup/complete', [AuthController::class, 'completePasswordSetup']);
    Route::middleware('jwt.auth')->get('/me', [AuthController::class, 'me']);
});

Route::middleware(['jwt.auth'])->group(function () {
    Route::get('/branches', [BranchController::class, 'index']);
    Route::get('/branches/{id}', [BranchController::class, 'show']);
    Route::post('/branches', [BranchController::class, 'store'])->middleware(RoleMiddleware::class . ':owner');
    Route::put('/branches/{id}', [BranchController::class, 'update'])->middleware(RoleMiddleware::class . ':owner');
    Route::delete('/branches/{id}', [BranchController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner');

    Route::get('/users', [UserController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/users', [UserController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/users/{id}', [UserController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/users/{id}', [UserController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner');

    Route::get('/members', [MemberController::class, 'index']);
    Route::get('/members/{id}', [MemberController::class, 'show']);
    Route::post('/members', [MemberController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/members/{id}/send-password-setup', [MemberController::class, 'sendPasswordSetup'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/members/{id}', [MemberController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/members/{id}', [MemberController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/coaches', [CoachController::class, 'index']);
    Route::get('/coaches/files', [CoachController::class, 'viewFile']);
    Route::get('/coaches/payroll', [CoachController::class, 'payroll']);
    Route::post('/coaches/payroll/{id}/mark-paid', [CoachController::class, 'markPayrollPaid'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::get('/coaches/{id}', [CoachController::class, 'show']);
    Route::post('/coaches', [CoachController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/coaches/{id}', [CoachController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/coaches/{id}', [CoachController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/packages', [PackageController::class, 'index']);
    Route::post('/packages', [PackageController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/packages/{id}', [PackageController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/packages/{id}', [PackageController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner');

    Route::get('/subscriptions', [SubscriptionController::class, 'index']);
    Route::post('/subscriptions', [SubscriptionController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/subscriptions/{id}', [SubscriptionController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/classes', [GymClassController::class, 'index']);
    Route::get('/classes/{id}', [GymClassController::class, 'show']);
    Route::post('/classes', [GymClassController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/classes/{id}', [GymClassController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/classes/{id}', [GymClassController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::post('/class-enrollments/enroll', [ClassEnrollmentController::class, 'enroll'])->middleware(RoleMiddleware::class . ':member');
    Route::get('/class-enrollments/{classId}', [ClassEnrollmentController::class, 'getEnrollments'])->middleware(RoleMiddleware::class . ':owner,admin,coach');
    Route::post('/class-enrollments/mark-attendance', [ClassEnrollmentController::class, 'markAttendance'])->middleware(RoleMiddleware::class . ':owner,coach');
    Route::get('/class-enrollments/member/{memberId}', [ClassEnrollmentController::class, 'getMemberEnrollments']);
    Route::get('/class-enrollment-blocks', [ClassEnrollmentController::class, 'getBlockedMembers'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/class-enrollment-blocks/unblock', [ClassEnrollmentController::class, 'unblockMember'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/bookings', [ClassBookingController::class, 'index']);
    Route::post('/bookings', [ClassBookingController::class, 'store']);
    Route::put('/bookings/{id}', [ClassBookingController::class, 'update']);

    Route::get('/payments', [PaymentController::class, 'index']);
    Route::post('/payments', [PaymentController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::get('/invoices', [InvoiceController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/invoices', [InvoiceController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::get('/pt-sessions', [PtSessionController::class, 'index']);
    Route::get('/pt-sessions/available-coaches', [PtSessionController::class, 'availableCoaches'])->middleware(RoleMiddleware::class . ':owner,admin,coach,member');
    Route::post('/pt-sessions', [PtSessionController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin,member');
    Route::put('/pt-sessions/{id}', [PtSessionController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin,coach,member');

    Route::get('/attendance', [AttendanceController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/attendance', [AttendanceController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/products/{id}', [ProductController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);

    Route::get('/leads', [LeadController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/leads', [LeadController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/leads/{id}', [LeadController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::get('/leads/{id}/tasks', [LeadTaskController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::post('/leads/{id}/tasks', [LeadTaskController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/lead-tasks/{id}', [LeadTaskController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/diet-plans', [DietPlanController::class, 'index']);
    Route::post('/diet-plans', [DietPlanController::class, 'store'])->middleware(RoleMiddleware::class . ':owner,admin,dietitian');
    Route::put('/diet-plans/{id}', [DietPlanController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin,dietitian');
    Route::delete('/diet-plans/{id}', [DietPlanController::class, 'destroy'])->middleware(RoleMiddleware::class . ':owner,admin,dietitian');

    Route::get('/contact-messages', [ContactMessageController::class, 'index'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::put('/contact-messages/{id}', [ContactMessageController::class, 'update'])->middleware(RoleMiddleware::class . ':owner,admin');

    Route::get('/dashboard/stats', [DashboardController::class, 'stats'])->middleware(RoleMiddleware::class . ':owner,admin');
    Route::get('/reports/overview', [ReportController::class, 'overview'])->middleware(RoleMiddleware::class . ':owner,admin');
});

Route::post('/contact', [ContactController::class, 'store']);
Route::post('/newsletter', [NewsletterController::class, 'store']);
