Start Living Right Gym

Hello {{ $memberName ?: 'member' }},

Your attendance for {{ $classTitle }} on {{ $classDate }} at {{ $startTime }} was updated to Attended.

You currently have {{ $noShowCount }} class no-{{ $noShowCount === 1 ? 'show' : 'shows' }} recorded.

@if ($isBlocked)
Because you still have 2 or more class no-shows, your class reservation access remains blocked until the front desk reviews and unblocks you.
@else
Your class reservation access is no longer blocked by the no-show policy.
@endif

Class: {{ $classTitle }}
Branch: {{ $branchName }}
Date: {{ $classDate }}
Time: {{ $startTime }}

Start Living Right Gym
