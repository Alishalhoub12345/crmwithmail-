<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Updated</title>
</head>
<body style="margin:0; padding:0; background-color:#f5efe2; font-family:Arial, Helvetica, sans-serif; color:#181818;">
@php
    $appUrl = rtrim(config('app.url'), '/');
    $logoUrl = $appUrl . '/start-gym-logo.jpg';
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5efe2; margin:0; padding:24px 0;">
    <tr>
        <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px; background-color:#fffdf8; border:1px solid #e6dcc7; border-radius:28px; overflow:hidden;">
                <tr>
                    <td style="padding:24px 32px; background:linear-gradient(135deg, #181818 0%, #2f2a20 100%);">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td valign="middle" style="width:88px;">
                                    <img src="{{ $logoUrl }}" alt="Start Living Right Gym" width="72" height="72" style="display:block; width:72px; height:72px; border-radius:18px; border:1px solid rgba(255,255,255,0.18); background:#6b6b70; padding:4px;">
                                </td>
                                <td valign="middle" style="color:#ffffff;">
                                    <div style="font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:#f4b516; font-weight:700;">Start Living Right Gym</div>
                                    <div style="font-size:28px; line-height:1.2; font-weight:700; margin-top:8px;">Your login was updated</div>
                                    <div style="font-size:14px; line-height:1.6; color:#ddd6c8; margin-top:8px;">Use the password below to sign in to your account.</div>
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
                            The gym team updated the login password for your Start Living Right Gym account.
                        </div>

                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px; background:#fbf6ea; border:1px solid #eadfca; border-radius:20px;">
                            <tr>
                                <td style="padding:20px 22px; text-align:center;">
                                    <div style="font-size:12px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#9b7c2f;">Password</div>
                                    <div style="margin-top:12px; font-size:28px; line-height:1.3; font-weight:700; letter-spacing:0.08em; color:#181818;">
                                        {{ $temporaryPassword }}
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px; background:#f7f3ea; border:1px solid #e6dcc7; border-radius:18px;">
                            <tr>
                                <td style="padding:18px 20px; font-size:14px; line-height:1.8; color:#5e564a;">
                                    1. Sign in with this password.<br>
                                    2. Change it from your account if you want a private password.<br>
                                    3. If you did not expect this update, contact the gym team.
                                </td>
                            </tr>
                        </table>

                        <div style="margin-top:28px; padding-top:20px; border-top:1px solid #ece3d1; font-size:13px; line-height:1.8; color:#7a7469;">
                            This message was sent from Start Living Right Gym account services.<br>
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
