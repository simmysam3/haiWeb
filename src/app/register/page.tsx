import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
            Join the HAIWAVE Network
          </h1>
          <p className="text-sm text-slate mt-2">
            Step 1 of 3: Create your account
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate/15 p-8">
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
              </div>
            </div>
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
                Job Title
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Phone
              </label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
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
              <p className="text-xs text-slate mt-1">
                Min 12 characters, uppercase, lowercase, digit, and special
                character required.
              </p>
            </div>
            <button
              type="submit"
              className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors"
            >
              Create Account
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-dark hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
