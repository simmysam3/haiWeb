export default function ProfilePage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Company Profile
      </h1>
      <p className="text-slate mb-8">
        Manage your company information visible on the HAIWAVE network.
      </p>

      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          Company profile form: legal name, business type, address, contacts,
          logo upload, industry tags, DBA, tax ID, DUNS, website, and
          description.
        </p>
      </div>
    </div>
  );
}
