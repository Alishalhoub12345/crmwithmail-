import { Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const normalizePhoneForTel = (phone: string) => phone.replace(/[^+\d]/g, "");
const normalizePhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, "");

interface PhoneActionsProps {
  phone?: string | null;
  phoneContent?: ReactNode;
  className?: string;
  phoneClassName?: string;
  actionClassName?: string;
  showPhoneIcon?: boolean;
}

export function PhoneActions({ phone, phoneContent, className, phoneClassName, actionClassName, showPhoneIcon = true }: PhoneActionsProps) {
  if (!phone) {
    return null;
  }

  const telPhone = normalizePhoneForTel(phone);
  const whatsappPhone = normalizePhoneForWhatsApp(phone);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <a href={`tel:${telPhone}`} className={cn("inline-flex items-center gap-1 hover:text-primary", phoneClassName)}>
        {showPhoneIcon && <Phone className="h-3.5 w-3.5" />}
        <span>{phoneContent ?? phone}</span>
      </a>
      {whatsappPhone && (
        <a
          href={`https://wa.me/${whatsappPhone}`}
          target="_blank"
          rel="noreferrer"
          className={cn("inline-flex items-center gap-1 text-green-600 hover:text-green-700", actionClassName)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>WhatsApp</span>
        </a>
      )}
    </div>
  );
}

interface EmailLinkProps {
  email?: string | null;
  className?: string;
}

export function EmailLink({ email, className }: EmailLinkProps) {
  if (!email) {
    return null;
  }

  return (
    <a href={`mailto:${email}`} className={cn("inline-flex items-center gap-1 hover:text-primary", className)}>
      <Mail className="h-3.5 w-3.5" />
      <span>{email}</span>
    </a>
  );
}
