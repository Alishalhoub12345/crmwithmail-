<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coach;
use App\Models\HrPayroll;
use App\Models\User;
use App\Support\PtSessionLifecycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CoachController extends Controller
{
    private const HR_ROLES = [
        'Owner',
        'Club Manager',
        'L&D Coach',
        'HR Supervisor',
        'FD Supervisor',
        'FD Officier',
        'Gym Supervisor',
        'Floor Trainer',
        'Personal Trainer',
        'Other',
    ];

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = DB::table('coaches')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->select([
                'coaches.id',
                'coaches.user_id as userId',
                'coaches.branch_id as branchId',
                'coaches.role_title as roleTitle',
                'coaches.specialization',
                'coaches.salary',
                'coaches.commission_rate as commissionRate',
                'coaches.bonus',
                'coaches.picture_path as picturePath',
                'coaches.certification_files as certificationFilesRaw',
                'coaches.document_files as documentFilesRaw',
                'coaches.certification_expiry_date as certificationExpiryDate',
                'coaches.legal_files as legalFilesRaw',
                'coaches.vacation_days_allowed as vacationDaysAllowed',
                'coaches.vacation_days_taken as vacationDaysTaken',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'coaches.status',
                'coaches.bio',
                'users.name as userName',
                'users.first_name as firstName',
                'users.last_name as lastName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'users.address',
                'users.unique_id as uniqueId',
                'users.gender',
                'users.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, users.birth_date, CURDATE()) as age'),
                'users.nationality',
                'users.emergency_contact_name as emergencyContactName',
                'users.emergency_contact_phone as emergencyContactPhone',
                'users.emergency_contact_email as emergencyContactEmail',
                DB::raw("(select GROUP_CONCAT(DISTINCT cba.branch_id order by cba.branch_id separator ',') from coach_branch_access cba where cba.coach_id = coaches.id) as branchIdsRaw"),
                DB::raw("(select GROUP_CONCAT(DISTINCT b2.name order by b2.name separator ', ') from coach_branch_access cba join branches b2 on cba.branch_id = b2.id where cba.coach_id = coaches.id) as branchNamesRaw"),
                'branches.name as branchName',
            ])
            ->orderByDesc('coaches.id');

        if ($actor->role !== 'owner') {
            $visibleBranchIds = $this->visibleBranchIdsForActor($actor);
            $query->where(function ($branchScope) use ($visibleBranchIds) {
                $branchScope->whereIn('coaches.branch_id', $visibleBranchIds)
                    ->orWhereExists(function ($exists) use ($visibleBranchIds) {
                        $exists->select(DB::raw(1))
                            ->from('coach_branch_access as cba')
                            ->whereColumn('cba.coach_id', 'coaches.id')
                            ->whereIn('cba.branch_id', $visibleBranchIds);
                    });
            });
        }

        return response()->json(
            $query->get()->map(fn ($coach) => $this->transformCoachPayload($coach))
        );
    }

    public function show(int $id): JsonResponse
    {
        $coach = DB::table('coaches')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->select([
                'coaches.id',
                'coaches.user_id as userId',
                'coaches.branch_id as branchId',
                'coaches.role_title as roleTitle',
                'coaches.specialization',
                'coaches.salary',
                'coaches.commission_rate as commissionRate',
                'coaches.bonus',
                'coaches.picture_path as picturePath',
                'coaches.certification_files as certificationFilesRaw',
                'coaches.document_files as documentFilesRaw',
                'coaches.certification_expiry_date as certificationExpiryDate',
                'coaches.legal_files as legalFilesRaw',
                'coaches.vacation_days_allowed as vacationDaysAllowed',
                'coaches.vacation_days_taken as vacationDaysTaken',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'coaches.status',
                'coaches.bio',
                'users.name as userName',
                'users.first_name as firstName',
                'users.last_name as lastName',
                'users.email as userEmail',
                'users.phone as userPhone',
                'users.address',
                'users.unique_id as uniqueId',
                'users.gender',
                'users.birth_date as birthDate',
                DB::raw('TIMESTAMPDIFF(YEAR, users.birth_date, CURDATE()) as age'),
                'users.nationality',
                'users.emergency_contact_name as emergencyContactName',
                'users.emergency_contact_phone as emergencyContactPhone',
                'users.emergency_contact_email as emergencyContactEmail',
                DB::raw("(select GROUP_CONCAT(DISTINCT cba.branch_id order by cba.branch_id separator ',') from coach_branch_access cba where cba.coach_id = coaches.id) as branchIdsRaw"),
                DB::raw("(select GROUP_CONCAT(DISTINCT b2.name order by b2.name separator ', ') from coach_branch_access cba join branches b2 on cba.branch_id = b2.id where cba.coach_id = coaches.id) as branchNamesRaw"),
                'branches.name as branchName',
            ])
            ->where('coaches.id', $id)
            ->first();

        if (!$coach) {
            return response()->json(['message' => 'Staff record not found'], 404);
        }

        return response()->json($this->transformCoachPayload($coach));
    }

    public function payroll(Request $request): JsonResponse
    {
        app(PtSessionLifecycle::class)->syncAutoCompletedSessions();

        $actor = $request->user();
        $today = Carbon::today();
        $coachQuery = DB::table('coaches')
            ->leftJoin('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'coaches.branch_id', '=', 'branches.id')
            ->select([
                'coaches.id',
                'coaches.branch_id as branchId',
                'coaches.salary',
                'coaches.commission_rate as commissionRate',
                'coaches.bonus',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'coaches.status',
                'users.name as userName',
                'branches.name as branchName',
            ])
            ->orderBy('users.name');

        if ($actor->role !== 'owner') {
            $coachQuery->where('coaches.branch_id', $actor->branch_id);
        }

        $coaches = $coachQuery->get();
        foreach ($coaches as $coach) {
            $this->syncCoachPayrolls($coach, $today);
        }

        $savedRows = DB::table('hr_payrolls')
            ->join('coaches', 'hr_payrolls.coach_id', '=', 'coaches.id')
            ->join('users', 'coaches.user_id', '=', 'users.id')
            ->leftJoin('branches', 'hr_payrolls.branch_id', '=', 'branches.id')
            ->when($actor->role !== 'owner', fn ($query) => $query->where('coaches.branch_id', $actor->branch_id))
            ->select([
                'hr_payrolls.id',
                'hr_payrolls.coach_id as coachId',
                'hr_payrolls.branch_id as branchId',
                'hr_payrolls.period_start as periodStart',
                'hr_payrolls.period_end as periodEnd',
                'hr_payrolls.base_salary as baseSalary',
                'hr_payrolls.bonus',
                'hr_payrolls.commission_rate as commissionRate',
                'hr_payrolls.class_sessions_count as classSessionsCount',
                'hr_payrolls.pt_sessions_count as ptSessionsCount',
                'hr_payrolls.commission_items_count as commissionItemsCount',
                'hr_payrolls.commission_amount as commissionAmount',
                'hr_payrolls.total_amount as totalDue',
                'hr_payrolls.status',
                'hr_payrolls.paid_at as paidAt',
                'coaches.hire_date as hireDate',
                'coaches.end_date as endDate',
                'users.name as userName',
                'branches.name as branchName',
            ])
            ->orderByDesc('hr_payrolls.period_end')
            ->orderBy('users.name')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'coachId' => (int) $row->coachId,
                'branchId' => $row->branchId ? (int) $row->branchId : null,
                'branchName' => $row->branchName,
                'userName' => $row->userName,
                'status' => $row->status,
                'hireDate' => $row->hireDate,
                'endDate' => $row->endDate,
                'baseSalary' => round((float) ($row->baseSalary ?? 0), 2),
                'bonus' => round((float) ($row->bonus ?? 0), 2),
                'commissionRate' => round((float) ($row->commissionRate ?? 0), 2),
                'classSessionsCount' => (int) ($row->classSessionsCount ?? 0),
                'ptSessionsCount' => (int) ($row->ptSessionsCount ?? 0),
                'commissionItemsCount' => (int) ($row->commissionItemsCount ?? 0),
                'commissionAmount' => round((float) ($row->commissionAmount ?? 0), 2),
                'totalDue' => round((float) ($row->totalDue ?? 0), 2),
                'periodStart' => $row->periodStart,
                'periodEnd' => $row->periodEnd,
                'paidAt' => $row->paidAt,
                'dueDate' => $row->periodEnd,
                'isPreview' => false,
                'payrollDueNow' => $row->status === 'pending',
            ])
            ->values();

        $previewRows = $coaches
            ->map(fn ($coach) => $this->buildCurrentPayrollPreview($coach, $today, $savedRows))
            ->filter()
            ->values();

        $rows = $previewRows
            ->concat($savedRows)
            ->sortBy([
                ['payrollDueNow', 'desc'],
                ['periodEnd', 'desc'],
                ['userName', 'asc'],
            ])
            ->values();

        $pendingRows = $rows->where('payrollDueNow', true)->values();

        return response()->json([
            'summary' => [
                'staffCount' => $rows->pluck('coachId')->unique()->count(),
                'recordCount' => $rows->count(),
                'dueCount' => $pendingRows->count(),
                'totalDue' => round((float) $pendingRows->sum('totalDue'), 2),
                'totalCommissionAmount' => round((float) $pendingRows->sum('commissionAmount'), 2),
            ],
            'items' => $rows,
        ]);
    }

    public function markPayrollPaid(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        $payroll = HrPayroll::query()
            ->with('coach')
            ->find($id);

        if (!$payroll) {
            return response()->json(['message' => 'Payroll record not found'], 404);
        }

        if ($actor->role !== 'owner' && (int) $payroll->coach?->branch_id !== (int) $actor->branch_id) {
            return response()->json(['message' => 'Payroll record not found'], 404);
        }

        if ($payroll->status === 'paid') {
            return response()->json([
                'id' => $payroll->id,
                'status' => $payroll->status,
                'paidAt' => $payroll->paid_at?->toDateTimeString(),
            ]);
        }

        $payroll->status = 'paid';
        $payroll->paid_at = now();
        $payroll->save();

        return response()->json([
            'id' => $payroll->id,
            'status' => $payroll->status,
            'paidAt' => $payroll->paid_at?->toDateTimeString(),
        ]);
    }

    public function viewFile(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $validated = $request->validate([
            'path' => ['required', 'string', 'max:2048'],
        ]);

        $path = ltrim((string) $validated['path'], '/');
        $allowedPrefixes = ['hr/pictures/', 'hr/certifications/', 'hr/documents/', 'hr/legal/'];
        $isAllowed = collect($allowedPrefixes)->contains(fn (string $prefix) => str_starts_with($path, $prefix));

        if (!$isAllowed || !Storage::disk('public')->exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->file(Storage::disk('public')->path($path));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateCoachRequest($request);
        $this->validateVacationBalance($validated);

        $storedPicture = $request->hasFile('picture')
            ? $this->storeSingleFile($request->file('picture'), 'hr/pictures')
            : null;

        $storedCertificationFiles = $this->storeManyFiles($this->uploadedFiles($request, 'certificationFiles'), 'hr/certifications');
        $storedDocumentFiles = $this->storeManyFiles($this->uploadedFiles($request, 'documentFiles'), 'hr/documents');
        $storedLegalFiles = $this->storeManyFiles($this->uploadedFiles($request, 'legalFiles'), 'hr/legal');

        $coach = DB::transaction(function () use (
            $validated,
            $storedPicture,
            $storedCertificationFiles,
            $storedDocumentFiles,
            $storedLegalFiles
        ) {
            $fullName = $this->resolveFullName($validated);

            $user = User::query()->create([
                'name' => $fullName,
                'first_name' => $validated['firstName'],
                'last_name' => $validated['lastName'] ?? null,
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'address' => $validated['address'] ?? null,
                'password' => Hash::make($validated['password'] ?? 'Staff@2024'),
                'role' => 'coach',
                'branch_id' => $validated['branchId'] ?? null,
                'unique_id' => $validated['uniqueId'] ?? $this->generateUniqueId(),
                'gender' => $validated['gender'] ?? null,
                'birth_date' => $validated['birthDate'] ?? null,
                'nationality' => $validated['nationality'] ?? null,
                'emergency_contact_name' => $validated['emergencyContactName'] ?? null,
                'emergency_contact_phone' => $validated['emergencyContactPhone'] ?? null,
                'emergency_contact_email' => $validated['emergencyContactEmail'] ?? null,
                'status' => ($validated['status'] ?? 'active') === 'active' ? 'active' : 'inactive',
            ]);

            $coach = Coach::query()->create([
                'user_id' => $user->id,
                'branch_id' => $validated['branchId'] ?? null,
                'role_title' => $validated['roleTitle'],
                'specialization' => $validated['roleTitle'],
                'salary' => $validated['salary'] ?? null,
                'commission_rate' => $validated['commissionRate'] ?? null,
                'bonus' => $validated['bonus'] ?? null,
                'picture_path' => $storedPicture,
                'certification_files' => $storedCertificationFiles,
                'document_files' => $storedDocumentFiles,
                'certification_expiry_date' => $validated['certificationExpiryDate'] ?? null,
                'legal_files' => $storedLegalFiles,
                'vacation_days_allowed' => $validated['vacationDaysAllowed'] ?? 0,
                'vacation_days_taken' => $validated['vacationDaysTaken'] ?? 0,
                'hire_date' => $validated['startDate'] ?? null,
                'end_date' => $validated['endDate'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'bio' => $validated['bio'] ?? null,
            ]);

            $coach->branches()->sync($validated['branchIds'] ?? array_filter([$validated['branchId'] ?? null]));

            return $coach;
        });

        return response()->json($this->show($coach->id)->getData(true), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $coach = Coach::query()->find($id);

        if (!$coach) {
            return response()->json(['message' => 'Staff record not found'], 404);
        }

        $user = User::query()->find($coach->user_id);
        $validated = $this->validateCoachRequest($request, $coach);
        $this->validateVacationBalance($validated);

        $existingCertificationFiles = $this->normalizeStoredFiles($coach->certification_files);
        $existingDocumentFiles = $this->normalizeStoredFiles($coach->document_files);
        $existingLegalFiles = $this->normalizeStoredFiles($coach->legal_files);

        $picturePath = $coach->picture_path;
        if ($request->hasFile('picture')) {
            $picturePath = $this->storeSingleFile($request->file('picture'), 'hr/pictures');
        } elseif (array_key_exists('picturePath', $validated)) {
            $picturePath = $validated['picturePath'] ?: null;
        }

        $certificationFiles = array_key_exists('certificationFiles', $validated)
            ? $this->normalizeStoredFiles($validated['certificationFiles'])
            : array_merge(
                $existingCertificationFiles,
                $this->storeManyFiles($this->uploadedFiles($request, 'certificationFiles'), 'hr/certifications')
            );

        $documentFiles = array_key_exists('documentFiles', $validated)
            ? $this->normalizeStoredFiles($validated['documentFiles'])
            : array_merge(
                $existingDocumentFiles,
                $this->storeManyFiles($this->uploadedFiles($request, 'documentFiles'), 'hr/documents')
            );

        $legalFiles = array_key_exists('legalFiles', $validated)
            ? $this->normalizeStoredFiles($validated['legalFiles'])
            : array_merge(
                $existingLegalFiles,
                $this->storeManyFiles($this->uploadedFiles($request, 'legalFiles'), 'hr/legal')
            );

        DB::transaction(function () use (
            $coach,
            $user,
            $validated,
            $picturePath,
            $certificationFiles,
            $documentFiles,
            $legalFiles
        ) {
            $mapping = [
                'branchId' => 'branch_id',
                'roleTitle' => 'role_title',
                'salary' => 'salary',
                'commissionRate' => 'commission_rate',
                'bonus' => 'bonus',
                'startDate' => 'hire_date',
                'endDate' => 'end_date',
                'status' => 'status',
                'bio' => 'bio',
                'certificationExpiryDate' => 'certification_expiry_date',
                'vacationDaysAllowed' => 'vacation_days_allowed',
                'vacationDaysTaken' => 'vacation_days_taken',
            ];

            $payload = [];
            foreach ($mapping as $input => $column) {
                if (array_key_exists($input, $validated)) {
                    $payload[$column] = $validated[$input];
                }
            }

            if (array_key_exists('roleTitle', $validated)) {
                $payload['specialization'] = $validated['roleTitle'];
            }

            $payload['picture_path'] = $picturePath;
            $payload['certification_files'] = $certificationFiles;
            $payload['document_files'] = $documentFiles;
            $payload['legal_files'] = $legalFiles;

            $coach->fill($payload)->save();

            if (array_key_exists('branchIds', $validated)) {
                $coach->branches()->sync($validated['branchIds']);
            }

            if ($user) {
                $userPayload = [];

                foreach ([
                    'branchId' => 'branch_id',
                    'email' => 'email',
                    'phone' => 'phone',
                    'address' => 'address',
                    'uniqueId' => 'unique_id',
                    'gender' => 'gender',
                    'birthDate' => 'birth_date',
                    'nationality' => 'nationality',
                    'emergencyContactName' => 'emergency_contact_name',
                    'emergencyContactPhone' => 'emergency_contact_phone',
                    'emergencyContactEmail' => 'emergency_contact_email',
                ] as $input => $column) {
                    if (array_key_exists($input, $validated)) {
                        $userPayload[$column] = $validated[$input];
                    }
                }

                if (
                    array_key_exists('firstName', $validated) ||
                    array_key_exists('lastName', $validated) ||
                    array_key_exists('name', $validated)
                ) {
                    $userPayload['first_name'] = $validated['firstName'] ?? $user->first_name;
                    $userPayload['last_name'] = array_key_exists('lastName', $validated)
                        ? $validated['lastName']
                        : $user->last_name;
                    $userPayload['name'] = $this->resolveFullName(array_merge([
                        'name' => $user->name,
                        'firstName' => $user->first_name,
                        'lastName' => $user->last_name,
                    ], $validated));
                }

                if (array_key_exists('status', $validated)) {
                    $userPayload['status'] = $validated['status'] === 'active' ? 'active' : 'inactive';
                }

                if (!empty($validated['password'])) {
                    $userPayload['password'] = Hash::make($validated['password']);
                }

                if ($userPayload !== []) {
                    $user->fill($userPayload)->save();
                }
            }
        });

        return response()->json($this->show($coach->id)->getData(true));
    }

    public function destroy(int $id): JsonResponse
    {
        $coach = Coach::query()->find($id);

        if (!$coach) {
            return response()->json(['message' => 'Staff record not found'], 404);
        }

        $coach->delete();

        return response()->json([], 204);
    }

    private function validateCoachRequest(Request $request, ?Coach $coach = null): array
    {
        $validated = $request->validate([
            'email' => [
                $coach ? 'sometimes' : 'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($coach?->user_id),
            ],
            'name' => ['nullable', 'string', 'max:255'],
            'firstName' => [$coach ? 'nullable' : 'required', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'branchIds' => ['nullable', 'array'],
            'branchIds.*' => ['integer', 'exists:branches,id'],
            'allBranches' => ['nullable', 'boolean'],
            'uniqueId' => ['nullable', 'string', 'max:100', Rule::unique('users', 'unique_id')->ignore($coach?->user_id)],
            'gender' => ['nullable', Rule::in(['male', 'female'])],
            'birthDate' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'emergencyContactName' => ['nullable', 'string', 'max:255'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:100'],
            'emergencyContactEmail' => ['nullable', 'email', 'max:255'],
            'roleTitle' => [$coach ? 'sometimes' : 'required', Rule::in(self::HR_ROLES)],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'commissionRate' => ['nullable', 'numeric', 'min:0'],
            'bonus' => ['nullable', 'numeric', 'min:0'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bio' => ['nullable', 'string'],
            'certificationExpiryDate' => ['nullable', 'date'],
            'vacationDaysAllowed' => ['nullable', 'integer', 'min:0'],
            'vacationDaysTaken' => ['nullable', 'integer', 'min:0'],
            'picturePath' => ['nullable', 'string', 'max:2048'],
            'picture' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx', 'max:10240'],
            'certificationFiles' => ['nullable', 'array'],
            'certificationFiles.*' => ['file', 'mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx', 'max:10240'],
            'documentFiles' => ['nullable', 'array'],
            'documentFiles.*' => ['file', 'mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx', 'max:10240'],
            'legalFiles' => ['nullable', 'array'],
            'legalFiles.*' => ['file', 'mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx', 'max:10240'],
        ]);

        $roleTitle = $validated['roleTitle'] ?? $coach?->role_title;
        $allBranches = filter_var($validated['allBranches'] ?? false, FILTER_VALIDATE_BOOL);
        $branchWasSubmitted = array_key_exists('branchId', $validated) || array_key_exists('branchIds', $validated);
        $roleChanged = array_key_exists('roleTitle', $validated) && $roleTitle !== $coach?->role_title;
        $selectedBranchIds = collect($validated['branchIds'] ?? [])
            ->push($validated['branchId'] ?? null)
            ->filter(fn ($value) => $value !== null && $value !== '')
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if ($allBranches) {
            if ($roleTitle !== 'Owner') {
                throw ValidationException::withMessages([
                    'allBranches' => 'All branches is only available for Owner role.',
                ]);
            }

            $validated['branchId'] = null;
            $validated['branchIds'] = [];

            return $validated;
        }

        if (!$coach || $branchWasSubmitted || $roleChanged) {
            if ($selectedBranchIds->isEmpty()) {
                throw ValidationException::withMessages([
                    'branchId' => 'Branch is required unless All branches is selected for Owner role.',
                ]);
            }
        }

        if ($selectedBranchIds->isNotEmpty()) {
            $validated['branchId'] = $selectedBranchIds->first();
            $validated['branchIds'] = $selectedBranchIds->all();
        }

        return $validated;
    }

    private function transformCoachPayload(object $coach): object
    {
        $coach->roleTitle = $coach->roleTitle ?: $coach->specialization;
        $branchIds = collect(explode(',', (string) ($coach->branchIdsRaw ?? '')))
            ->filter(fn ($value) => $value !== '')
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();
        $coach->branchIds = $branchIds !== [] ? $branchIds : array_values(array_filter([(int) ($coach->branchId ?? 0)]));
        $coach->pictureUrl = $this->fileUrl($coach->picturePath ?? null);
        $coach->certificationFiles = $this->decorateFiles($coach->certificationFilesRaw ?? null);
        $coach->documentFiles = $this->decorateFiles($coach->documentFilesRaw ?? null);
        $coach->legalFiles = $this->decorateFiles($coach->legalFilesRaw ?? null);
        $coach->vacationDaysAllowed = (int) ($coach->vacationDaysAllowed ?? 0);
        $coach->vacationDaysTaken = (int) ($coach->vacationDaysTaken ?? 0);
        $coach->vacationDaysBalance = max(0, $coach->vacationDaysAllowed - $coach->vacationDaysTaken);
        $coach->branchName = $coach->branchNamesRaw ?: ($coach->branchName ?: ($coach->branchId ? null : 'All branches'));

        $expiry = !empty($coach->certificationExpiryDate)
            ? Carbon::parse($coach->certificationExpiryDate)
            : null;
        $daysUntilExpiry = $expiry ? Carbon::today()->diffInDays($expiry, false) : null;

        $coach->certificationDaysUntilExpiry = $daysUntilExpiry;
        $coach->certificationReminderNeeded = $daysUntilExpiry !== null && $daysUntilExpiry <= 30;
        $coach->certificationReminderStatus = $daysUntilExpiry === null
            ? null
            : ($daysUntilExpiry < 0 ? 'expired' : ($daysUntilExpiry <= 30 ? 'expiring_soon' : 'valid'));

        unset(
            $coach->certificationFilesRaw,
            $coach->documentFilesRaw,
            $coach->legalFilesRaw,
            $coach->branchIdsRaw,
            $coach->branchNamesRaw
        );

        return $coach;
    }

    private function resolveFullName(array $validated): string
    {
        if (!empty($validated['name'])) {
            return trim((string) $validated['name']);
        }

        return trim(implode(' ', array_filter([
            $validated['firstName'] ?? null,
            $validated['lastName'] ?? null,
        ])));
    }

    private function validateVacationBalance(array $validated): void
    {
        $allowed = (int) ($validated['vacationDaysAllowed'] ?? 0);
        $taken = (int) ($validated['vacationDaysTaken'] ?? 0);

        if ($taken > $allowed) {
            throw ValidationException::withMessages([
                'vacationDaysTaken' => 'Vacation days taken cannot exceed vacation days allowed.',
            ]);
        }
    }

    private function generateUniqueId(): string
    {
        $existing = DB::table('users')
            ->where('unique_id', 'like', 'SLR-%')
            ->pluck('unique_id');

        $max = 0;
        foreach ($existing as $value) {
            if (preg_match('/^SLR-(\d+)$/i', (string) $value, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return 'SLR-' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    private function storeSingleFile(?UploadedFile $file, string $directory): ?string
    {
        if (!$file) {
            return null;
        }

        return $file->store($directory, 'public');
    }

    /**
     * @param  array<int, UploadedFile>|UploadedFile|null  $files
     * @return array<int, string>
     */
    private function storeManyFiles(array|UploadedFile|null $files, string $directory): array
    {
        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        return collect($files ?? [])
            ->filter(fn ($file) => $file instanceof UploadedFile)
            ->map(fn (UploadedFile $file) => $file->store($directory, 'public'))
            ->values()
            ->all();
    }

    /**
     * @return array<int, UploadedFile>|UploadedFile|null
     */
    private function uploadedFiles(Request $request, string $key): array|UploadedFile|null
    {
        return $request->file($key)
            ?? $request->file($key . '[]')
            ?? [];
    }

    /**
     * @param  mixed  $value
     * @return array<int, string>
     */
    private function normalizeStoredFiles(mixed $value): array
    {
        if ($value instanceof Collection) {
            return $value->filter()->values()->all();
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return array_values(array_filter($decoded));
            }

            return $value !== '' ? [$value] : [];
        }

        if (is_array($value)) {
            return array_values(array_filter($value));
        }

        return [];
    }

    /**
     * @param  mixed  $value
     * @return array<int, array{name:string,path:string,url:string}>
     */
    private function decorateFiles(mixed $value): array
    {
        return collect($this->normalizeStoredFiles($value))
            ->map(fn (string $path) => [
                'name' => basename($path),
                'path' => $path,
                'url' => $this->fileUrl($path),
            ])
            ->values()
            ->all();
    }

    private function fileUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return url('/api/coaches/files?path=' . urlencode($path));
    }

    /**
     * @return array<int, int>
     */
    private function visibleBranchIdsForActor(User $actor): array
    {
        $branchIds = collect([$actor->branch_id])
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value);

        if ($actor->role === 'member') {
            $member = DB::table('members')
                ->where('user_id', $actor->id)
                ->select(['id', 'branch_id'])
                ->first();

            if ($member) {
                $branchIds = $branchIds
                    ->push($member->branch_id)
                    ->merge(
                        DB::table('member_branch_access')
                            ->where('member_id', $member->id)
                            ->pluck('branch_id')
                    );
            }
        }

        if ($actor->role === 'coach') {
            $coach = DB::table('coaches')
                ->where('user_id', $actor->id)
                ->select(['id', 'branch_id'])
                ->first();

            if ($coach) {
                $branchIds = $branchIds
                    ->push($coach->branch_id)
                    ->merge(
                        DB::table('coach_branch_access')
                            ->where('coach_id', $coach->id)
                            ->pluck('branch_id')
                    );
            }
        }

        return $branchIds
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();
    }

    private function syncCoachPayrolls(object $coach, Carbon $today): void
    {
        $hireDate = $coach->hireDate ? Carbon::parse($coach->hireDate)->startOfDay() : null;
        if (!$hireDate) {
            return;
        }

        $limitDate = $coach->endDate
            ? Carbon::parse($coach->endDate)->startOfDay()->min($today)
            : $today->copy();

        $cycleStart = $hireDate->copy();
        $cycleEnd = $cycleStart->copy()->addMonthNoOverflow()->subDay()->startOfDay();

        while ($cycleEnd->lte($limitDate)) {
            HrPayroll::query()->firstOrCreate(
                [
                    'coach_id' => $coach->id,
                    'period_start' => $cycleStart->toDateString(),
                    'period_end' => $cycleEnd->toDateString(),
                ],
                $this->buildPayrollSnapshot($coach, $cycleStart, $cycleEnd)
            );

            $cycleStart = $cycleStart->copy()->addMonthNoOverflow()->startOfDay();
            $cycleEnd = $cycleStart->copy()->addMonthNoOverflow()->subDay()->startOfDay();
        }
    }

    private function buildPayrollSnapshot(object $coach, Carbon $periodStart, Carbon $periodEnd): array
    {
        $classSessionsCount = DB::table('classes')
            ->where('coach_id', $coach->id)
            ->whereBetween('class_date', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->whereNotIn('status', ['inactive', 'canceled'])
            ->count();

        $ptSessionsCount = DB::table('pt_sessions')
            ->where('coach_id', $coach->id)
            ->whereBetween('session_date', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->whereIn('status', PtSessionLifecycle::CREDIT_CONSUMING_STATUSES)
            ->count();

        $baseSalary = (float) ($coach->salary ?? 0);
        $bonus = (float) ($coach->bonus ?? 0);
        $commissionRate = (float) ($coach->commissionRate ?? 0);
        $commissionItemsCount = $classSessionsCount + $ptSessionsCount;
        $commissionAmount = $commissionRate * $commissionItemsCount;

        return [
            'branch_id' => $coach->branchId ?: null,
            'base_salary' => round($baseSalary, 2),
            'bonus' => round($bonus, 2),
            'commission_rate' => round($commissionRate, 2),
            'class_sessions_count' => $classSessionsCount,
            'pt_sessions_count' => $ptSessionsCount,
            'commission_items_count' => $commissionItemsCount,
            'commission_amount' => round($commissionAmount, 2),
            'total_amount' => round($baseSalary + $bonus + $commissionAmount, 2),
            'status' => 'pending',
            'paid_at' => null,
        ];
    }

    private function buildCurrentPayrollPreview(object $coach, Carbon $today, Collection $savedRows): ?array
    {
        $hireDate = $coach->hireDate ? Carbon::parse($coach->hireDate)->startOfDay() : null;
        if (!$hireDate) {
            return null;
        }

        $latestSavedPeriodEnd = $savedRows
            ->where('coachId', (int) $coach->id)
            ->pluck('periodEnd')
            ->filter()
            ->map(fn ($periodEnd) => Carbon::parse($periodEnd))
            ->sortByDesc(fn (Carbon $periodEnd) => $periodEnd->timestamp)
            ->first();

        $periodStart = $latestSavedPeriodEnd
            ? $latestSavedPeriodEnd->copy()->addDay()->startOfDay()
            : $hireDate->copy();
        $periodEnd = $periodStart->copy()->addMonthNoOverflow()->subDay()->startOfDay();

        if ($coach->endDate) {
            $endDate = Carbon::parse($coach->endDate)->startOfDay();
            if ($endDate->lt($periodStart)) {
                return null;
            }

            if ($endDate->lt($periodEnd)) {
                $periodEnd = $endDate->copy();
            }
        }

        $snapshot = $this->buildPayrollSnapshot($coach, $periodStart, $today->copy()->min($periodEnd));

        return [
            'id' => 'preview-' . $coach->id,
            'coachId' => (int) $coach->id,
            'branchId' => $coach->branchId ? (int) $coach->branchId : null,
            'branchName' => $coach->branchName,
            'userName' => $coach->userName,
            'status' => 'not_due_yet',
            'hireDate' => $coach->hireDate,
            'endDate' => $coach->endDate,
            'baseSalary' => round((float) ($snapshot['base_salary'] ?? 0), 2),
            'bonus' => round((float) ($snapshot['bonus'] ?? 0), 2),
            'commissionRate' => round((float) ($snapshot['commission_rate'] ?? 0), 2),
            'classSessionsCount' => (int) ($snapshot['class_sessions_count'] ?? 0),
            'ptSessionsCount' => (int) ($snapshot['pt_sessions_count'] ?? 0),
            'commissionItemsCount' => (int) ($snapshot['commission_items_count'] ?? 0),
            'commissionAmount' => round((float) ($snapshot['commission_amount'] ?? 0), 2),
            'totalDue' => round((float) ($snapshot['total_amount'] ?? 0), 2),
            'periodStart' => $periodStart->toDateString(),
            'periodEnd' => $periodEnd->toDateString(),
            'paidAt' => null,
            'dueDate' => $periodEnd->toDateString(),
            'isPreview' => true,
            'payrollDueNow' => false,
        ];
    }

    /**
     * @return array{periodStart:?Carbon,periodEnd:?Carbon,nextPayrollDate:?Carbon,isDue:bool}
     */
    private function resolvePayrollWindow(?Carbon $hireDate, Carbon $today): array
    {
        if (!$hireDate) {
            return [
                'periodStart' => null,
                'periodEnd' => null,
                'nextPayrollDate' => null,
                'isDue' => false,
            ];
        }

        $cycleStart = $hireDate->copy()->startOfDay();
        $cycleEnd = $cycleStart->copy()->addMonthNoOverflow()->subDay()->startOfDay();
        $lastCompletedStart = null;
        $lastCompletedEnd = null;

        while ($today->gte($cycleEnd)) {
            $lastCompletedStart = $cycleStart->copy();
            $lastCompletedEnd = $cycleEnd->copy();
            $cycleStart = $cycleStart->copy()->addMonthNoOverflow()->startOfDay();
            $cycleEnd = $cycleStart->copy()->addMonthNoOverflow()->subDay()->startOfDay();
        }

        return [
            'periodStart' => $lastCompletedStart,
            'periodEnd' => $lastCompletedEnd,
            'nextPayrollDate' => $cycleEnd->copy(),
            'isDue' => $lastCompletedStart !== null && $lastCompletedEnd !== null,
        ];
    }
}
