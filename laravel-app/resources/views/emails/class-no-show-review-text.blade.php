Start Living Right Gym

Hello {{ $memberName ?: 'member' }},

You were marked as not attended for {{ $classTitle }} on {{ $classDate }} at {{ $startTime }}.

@if ($isBlocked)
You have reached {{ $noShowCount }} class no-shows. Your class reservation access is now blocked, and you cannot enroll in another class until the front desk reviews your account and unblocks you.
@else
This is a class no-show warning. A second no-show will block your class reservation access until the front desk reviews your account.
@endif

Please review this with the front desk if the attendance record needs correction.

Class: {{ $classTitle }}
Branch: {{ $branchName }}
Date: {{ $classDate }}
Time: {{ $startTime }}

Start Living Right Gym
