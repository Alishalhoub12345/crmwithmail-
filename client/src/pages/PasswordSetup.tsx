import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getPasswordChecks, isStrongPassword } from "@/lib/password";

export default function PasswordSetup() {
  const [, navigate] = useLocation();
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (search.get("email") || search.get("amp;email") || "").split("?")[0];
  const token = (search.get("token") || "").split("&")[0];

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordChecks = getPasswordChecks(password);

  useEffect(() => {
    let active = true;

    const validateLink = async () => {
      if (!email || !token) {
        setError("This account access link is incomplete.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest("POST", "/api/auth/password-setup/validate", { email, token });
        const data = await response.json();

        if (!active) {
          return;
        }

        setName(data.name || "");
      } catch (err: any) {
        if (!active) {
          return;
        }

        setError(err.message || "This account access link is invalid or expired.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void validateLink();

    return () => {
      active = false;
    };
  }, [email, token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isStrongPassword(password)) {
      setError("Password must include one capital letter, one number, and one special character.");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/auth/password-setup/complete", {
        email,
        token,
        password,
        passwordConfirmation,
      });
      const data = await response.json();
      setSuccess(data.message || "Password updated successfully.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f3ea] p-6">
      <div className="w-full max-w-md rounded-[28px] border border-[#e7dcc4] bg-white p-8 shadow-[0_24px_80px_rgba(35,28,16,0.08)]">
        <img
          src="/start-gym-logo.jpg"
          alt="Start Gym Living Right"
          className="mb-6 h-20 w-auto rounded-2xl border border-black/10 bg-[#6b6b70] p-1.5 shadow-lg"
        />
        <h1 className="text-3xl font-bold text-[#181818]">Set Up Your Account</h1>
        <p className="mt-2 text-sm text-[#5a5a5a]">
          {name ? `Choose and confirm a password for ${name}.` : "Choose and confirm your Start Gym password."}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error && !success ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#303030]">Email address</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-xl border border-[#d7d1c2] bg-[#f5f5f5] px-3.5 py-3 text-sm text-[#181818] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#303030]">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#d7d1c2] bg-white px-3.5 py-3 text-sm text-[#181818] transition-colors focus:border-[#f4b516] focus:outline-none focus:ring-2 focus:ring-[#f4b516]/20"
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasUppercase || !password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>A-Z</span>
                <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasDigit || !password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>0-9</span>
                <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasSpecial || !password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>Special</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#303030]">Confirm password</label>
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full rounded-xl border border-[#d7d1c2] bg-white px-3.5 py-3 text-sm text-[#181818] transition-colors focus:border-[#f4b516] focus:outline-none focus:ring-2 focus:ring-[#f4b516]/20"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f4b516] px-4 py-3 text-sm font-semibold text-[#181818] transition-colors hover:bg-[#ddb012] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
