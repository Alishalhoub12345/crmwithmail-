import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PhoneActions } from "@/components/ContactLinks";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, MapPin, Phone } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { user, loginMutation, resetPasswordMutation } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ email, password });
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err.message?.includes("401")
        ? "Invalid email or password"
        : (err.message || "Login failed");
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await resetPasswordMutation.mutateAsync({ email });
      toast({
        title: "Password reset requested",
        description: data.message || "If the account exists, a password setup link has been sent.",
      });
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err.message || "Failed to send the password setup link.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] lg:flex">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-white/10 bg-[#181818] p-10 lg:flex xl:p-12">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "linear-gradient(160deg, rgba(244,181,22,0.08) 0%, rgba(18,18,18,0) 38%), radial-gradient(circle at top left, rgba(255,255,255,0.08) 0%, transparent 48%)",
          }}
        />

        <div className="relative z-10 max-w-2xl">
          <img
            src="/start-gym-logo.jpg"
            alt="Start Gym Living Right"
            className="h-28 w-auto rounded-2xl border border-white/10 bg-[#6b6b70] p-2 shadow-2xl shadow-black/30"
          />
          <div className="mt-8 max-w-xl">
            <h1 className="text-5xl font-bold tracking-tight text-white">
              Start Gym management, built around your real branches.
            </h1>
            <p className="mt-4 text-lg leading-8 text-white/70">
              Manage members, coaches, classes, payments, and branch operations in one place with a brand that matches your club.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            {
              src: "/start-gym-floor.jpeg",
              title: "Broumana Branch",
              location: "Broumana Main Street, Lebanon",
              phone: "76 446 496",
              desc: "Main sports club branch with spacious strength and cardio training areas.",
            },
            {
              src: "/start-gym-training.jpg",
              title: "Faqra Branch",
              location: "Faqra, Kfardebian, Oakridge",
              phone: "76 496 999",
              desc: "Premium coaching-focused branch designed for guided sessions and private training.",
            },
            {
              src: "/start-gym-logo.jpg",
              title: "El Abyad Branch",
              location: "El Abyad Center, Sea Side Rd",
              phone: "76 496 999",
              desc: "City-access branch with quick entry, strong visibility, and convenient member access.",
            },
          ].map(({ src, title, location, phone, desc }) => (
            <div key={title} className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-xl shadow-black/25">
              <img src={src} alt={title} className="h-52 w-full object-cover" />
              <div className="space-y-3 p-5">
                <div className="text-lg font-semibold text-white">{title}</div>
                <div className="flex items-start gap-2 text-xs leading-5 text-white/65">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#f4b516]" />
                  <span>{location}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/65">
                  <Phone className="h-4 w-4 flex-shrink-0 text-[#f4b516]" />
                  <PhoneActions phone={phone} className="text-white/65" phoneClassName="text-white/65" actionClassName="text-green-400" showPhoneIcon={false} />
                </div>
                <div className="text-sm leading-6 text-white/65">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-[#f7f3ea] p-8 lg:max-w-md xl:max-w-lg">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-6 lg:hidden">
              <img
                src="/start-gym-logo.jpg"
                alt="Start Gym Living Right"
                className="h-20 w-auto rounded-2xl border border-black/10 bg-[#6b6b70] p-1.5 shadow-lg"
              />
            </div>

            <h2 className="text-3xl font-bold text-[#181818]">Welcome back</h2>
            <p className="mt-2 text-sm text-[#5a5a5a]">Sign in to manage Start Living Right Gym operations.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#303030]">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
                className="w-full rounded-xl border border-[#d7d1c2] bg-white px-3.5 py-3 text-sm text-[#181818] transition-colors focus:border-[#f4b516] focus:outline-none focus:ring-2 focus:ring-[#f4b516]/20"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#303030]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  className="w-full rounded-xl border border-[#d7d1c2] bg-white px-3.5 py-3 pr-10 text-sm text-[#181818] transition-colors focus:border-[#f4b516] focus:outline-none focus:ring-2 focus:ring-[#f4b516]/20"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b70] hover:text-[#181818]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              data-testid="button-login"
              disabled={loginMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f4b516] px-4 py-3 text-sm font-semibold text-[#181818] transition-colors hover:bg-[#ddb012] disabled:opacity-50"
            >
              {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={resetPasswordMutation.isPending}
              className="w-full rounded-xl border border-[#d7d1c2] bg-white px-4 py-3 text-sm font-medium text-[#303030] transition-colors hover:bg-[#f7f3ea] disabled:opacity-50"
            >
              {resetPasswordMutation.isPending ? "Sending setup link..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
