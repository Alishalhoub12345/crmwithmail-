<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class Attendance Updated</title>
</head>
<body style="margin:0; padding:0; background-color:#f5efe2; font-family:Arial, Helvetica, sans-serif; color:#181818;">
@php
    $appUrl = rtrim(config('app.url'), '/');
    $logoUrl = $appUrl . '/start-gym-logo.jpg';
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5efe2; margin:0; padding:24px 0;">
    <tr>
        <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px; background-color:#fffdf8; border:1px solid #e6dcc7; border-radius:24px; overflow:hidden;">
                <tr>
                    <td style="padding:24px 32px; background:#181818;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td valign="middle" style="width:88px;">
                                    <img src="{{ $logoUrl }}" alt="Start Living Right Gym" width="72" height="72" style="display:block; width:72px; height:72px; border-radius:18px; border:1px solid rgba(255,255,255,0.18); background:#6b6b70; padding:4px;">
                                </td>
                                <td valign="middle" style="color:#ffffff;">
                                    <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#f4b516; font-weight:700;">Start Living Right Gym</div>
                                    <div style="font-size:26px; line-height:1.2; font-weight:700; margin-top:8px;">Class attendance updated</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:32px;">
                        <div style="font-size:16px; line-height:1.7; color:#3f3a32;">
                            Hello <strong style="color:#181818;">{{ $memberName ?: 'member' }}</strong>,
                        </div>
                        <div style="margin-top:16px; font-size:15px; line-height:1.8; color:#5a5246;">
                            Your attendance for <strong>{{ $classTitle }}</strong> on {{ $classDate }} at {{ $startTime }} was updated to <strong>Attended</strong>.
                        </div>
                        <div style="margin-top:16px; font-size:15px; line-height:1.8; color:#5a5246;">
                            You currently have {{ $noShowCount }} class no-{{ $noShowCount === 1 ? 'show' : 'shows' }} recorded.
                        </div>
                        @if ($isBlocked)
                            <div style="margin-top:16px; font-size:15px; line-height:1.8; color:#5a5246;">
                                Because you still have 2 or more class no-shows, your class reservation access remains blocked until the front desk reviews and unblocks you.
                            </div>
                        @else
                            <div style="margin-top:16px; font-size:15px; line-height:1.8; color:#5a5246;">
                                Your class reservation access is no longer blocked by the no-show policy.
                            </div>
                        @endif
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px; background:#fbf6ea; border:1px solid #eadfca; border-radius:18px;">
                            <tr>
                                <td style="padding:18px 20px; font-size:14px; line-height:1.8; color:#5e564a;">
                                    Class: {{ $classTitle }}<br>
                                    Branch: {{ $branchName }}<br>
                                    Date: {{ $classDate }}<br>
                                    Time: {{ $startTime }}
                                </td>
                            </tr>
                        </table>
                        <div style="margin-top:28px; padding-top:20px; border-top:1px solid #ece3d1; font-size:13px; line-height:1.8; color:#7a7469;">
                            Start Living Right Gym
                        </div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
