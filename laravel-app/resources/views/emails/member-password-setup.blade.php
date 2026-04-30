<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Start Living Right Gym Invitation</title>
</head>
<body style="margin:0; padding:0; background:#111111; font-family:Arial, Helvetica, sans-serif; color:#1f2933;">
@php
    $appUrl = rtrim(config('app.url'), '/');
    $logoUrl = $appUrl . '/start-gym-logo.jpg';
@endphp
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    Your Start Living Right Gym portal invitation is ready.
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#111111; margin:0; padding:0;">
    <tr>
        <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px; background:#111111;">
                <tr>
                    <td style="padding:34px 28px 22px; background:#111111;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td valign="middle" style="width:76px;">
                                    <img src="{{ $logoUrl }}" alt="Start Living Right Gym" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px; border:1px solid rgba(255,255,255,0.16); background:#6b6b70; padding:4px;">
                                </td>
                                <td valign="middle" style="color:#ffffff;">
                                    <div style="font-size:12px; letter-spacing:0.2em; text-transform:uppercase; color:#f4b516; font-weight:700;">Member Portal</div>
                                    <div style="font-size:30px; line-height:1.2; font-weight:700; margin-top:8px;">Account access is ready</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 28px 34px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff; border-radius:0; border-top:5px solid #f4b516;">
                            <tr>
                                <td style="padding:30px 30px 24px;">
                                    <div style="font-size:16px; line-height:1.7; color:#1f2933;">
                                        Hello <strong>{{ $memberName ?: 'member' }}</strong>,
                                    </div>

                                    <div style="margin-top:14px; font-size:15px; line-height:1.8; color:#4b5563;">
                                        Your Start Living Right Gym member account is ready. Please use the secure button below to choose your password and confirm it on our account setup page.
                                    </div>

                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">
                                        <tr>
                                            <td align="left">
                                                <a href="{{ $setupUrl }}" style="display:inline-block; background:#f4b516; color:#181818; text-decoration:none; font-size:15px; font-weight:700; padding:14px 22px; border-radius:4px;">
                                                    Set Up Account Access
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px; border-left:4px solid #f4b516; background:#f8f8f8;">
                                        <tr>
                                            <td style="padding:15px 18px; font-size:14px; line-height:1.8; color:#5c6470;">
                                                This secure link expires in <strong style="color:#1f2933;">24 hours</strong>. If the button does not open, copy and paste this link into your browser:
                                                <div style="margin-top:10px; font-size:12px; line-height:1.7; color:#6b7280; word-break:break-all;">
                                                    {{ $setupUrl }}
                                                </div>
                                            </td>
                                        </tr>
                                    </table>

                                    <div style="margin-top:24px; padding-top:18px; border-top:1px solid #e5e7eb; font-size:13px; line-height:1.7; color:#6b7280;">
                                        If you did not expect this email, you can safely ignore it or contact the gym team.
                                    </div>

                                    <div style="margin-top:18px; font-size:13px; line-height:1.7; color:#6b7280;">
                                        Start Living Right Gym
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
