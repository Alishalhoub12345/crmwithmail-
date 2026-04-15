<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\GymPackage;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class GymCrmSeeder extends Seeder
{
    public function run(): void
    {
        $broumana = Branch::query()->firstOrCreate(
            ['email' => 'broumana@startlivingright.com'],
            [
                'name' => 'Start Living Right Gym - Broumana',
                'location' => 'Broumana Main Street, Lebanon',
                'phone' => '76 446 496',
                'status' => 'active',
            ]
        );

        $elAbyad = Branch::query()->firstOrCreate(
            ['email' => 'elabyad@startlivingright.com'],
            [
                'name' => 'Start Living Right Gym - El Abyad',
                'location' => 'El Abyad Center, Sea Side Rd, Lebanon',
                'phone' => '76 496 999',
                'status' => 'active',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'alishalhoub444@gmail.com'],
            [
                'name' => 'System Owner',
                'password' => Hash::make('123Ali123$'),
                'role' => 'owner',
                'branch_id' => null,
                'phone' => '+1-555-0001',
                'status' => 'active',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'admin@startlivingright.com'],
            [
                'name' => 'System Admin',
                'password' => Hash::make('Admin123$'),
                'role' => 'admin',
                'branch_id' => $broumana->id,
                'phone' => '+1-555-0002',
                'status' => 'active',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'manager.elabyad@startlivingright.com'],
            [
                'name' => 'El Abyad Admin',
                'password' => Hash::make('Admin123$'),
                'role' => 'admin',
                'branch_id' => $elAbyad->id,
                'phone' => '+1-555-0003',
                'status' => 'active',
            ]
        );

        $testPackages = [
            [
                'name' => 'Monthly Membership Test',
                'package_type' => 'membership',
                'tier' => 'silver',
                'billing_cycle' => '1_month',
                'description' => 'Testing package for normal gym membership.',
                'price' => 50,
                'duration_days' => 30,
                'branch_id' => null,
                'gym_access_hours' => 30,
                'coach_hours' => 0,
                'dietitian_hours' => 0,
                'allows_all_branches' => true,
                'sessions_per_week' => 7,
                'total_classes' => 0,
                'included_pt_sessions' => 0,
                'allows_freeze' => true,
                'freeze_days_allowed' => 7,
                'auto_renew' => false,
                'includes_gym_access' => true,
                'includes_classes' => false,
                'status' => 'active',
            ],
            [
                'name' => 'Freelance PT Test 5 Sessions',
                'package_type' => 'personal_training',
                'tier' => 'bronze',
                'billing_cycle' => '1_month',
                'description' => 'Testing package for freelance trainer assignment.',
                'price' => 120,
                'duration_days' => 30,
                'branch_id' => null,
                'gym_access_hours' => 0,
                'coach_hours' => 5,
                'dietitian_hours' => 0,
                'allows_all_branches' => true,
                'sessions_per_week' => 2,
                'total_classes' => 0,
                'included_pt_sessions' => 5,
                'allows_freeze' => true,
                'freeze_days_allowed' => 5,
                'auto_renew' => false,
                'includes_gym_access' => false,
                'includes_classes' => false,
                'status' => 'active',
            ],
            [
                'name' => 'Freelance PT Test 12 Sessions',
                'package_type' => 'personal_training',
                'tier' => 'gold',
                'billing_cycle' => '3_months',
                'description' => 'Longer testing package for freelance trainer work.',
                'price' => 260,
                'duration_days' => 90,
                'branch_id' => null,
                'gym_access_hours' => 0,
                'coach_hours' => 12,
                'dietitian_hours' => 0,
                'allows_all_branches' => true,
                'sessions_per_week' => 3,
                'total_classes' => 0,
                'included_pt_sessions' => 12,
                'allows_freeze' => true,
                'freeze_days_allowed' => 10,
                'auto_renew' => false,
                'includes_gym_access' => false,
                'includes_classes' => false,
                'status' => 'active',
            ],
            [
                'name' => 'Hybrid Test Package',
                'package_type' => 'hybrid',
                'tier' => 'gold',
                'billing_cycle' => '1_month',
                'description' => 'Testing package with gym access, PT, and classes.',
                'price' => 180,
                'duration_days' => 30,
                'branch_id' => null,
                'gym_access_hours' => 30,
                'coach_hours' => 4,
                'dietitian_hours' => 2,
                'allows_all_branches' => true,
                'sessions_per_week' => 4,
                'total_classes' => 8,
                'included_pt_sessions' => 4,
                'allows_freeze' => true,
                'freeze_days_allowed' => 7,
                'auto_renew' => false,
                'includes_gym_access' => true,
                'includes_classes' => true,
                'status' => 'active',
            ],
            [
                'name' => 'Classes Test Package',
                'package_type' => 'membership',
                'tier' => 'bronze',
                'billing_cycle' => '1_month',
                'description' => 'Testing package for class-only selection in the popup.',
                'price' => 70,
                'duration_days' => 30,
                'branch_id' => null,
                'gym_access_hours' => 0,
                'coach_hours' => 0,
                'dietitian_hours' => 0,
                'allows_all_branches' => true,
                'sessions_per_week' => 3,
                'total_classes' => 12,
                'included_pt_sessions' => 0,
                'allows_freeze' => true,
                'freeze_days_allowed' => 5,
                'auto_renew' => false,
                'includes_gym_access' => false,
                'includes_classes' => true,
                'status' => 'active',
            ],
        ];

        foreach ($testPackages as $package) {
            GymPackage::query()->updateOrCreate(
                ['name' => $package['name']],
                $package
            );
        }
    }
}
