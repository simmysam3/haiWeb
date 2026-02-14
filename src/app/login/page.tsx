import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
            Sign in to HAIWAVE
          </h1>
          <p className="text-sm text-slate mt-2">
            Access your account portal
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate/15 p-8">
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-teal-dark hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
