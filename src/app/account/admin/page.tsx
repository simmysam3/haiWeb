import Link from 'next/link';

export default function AdminLanding() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">HAIWAVE Admin</h1>
      <ul className="space-y-2">
        <li>
          <Link href="/account/admin/agent-config" className="text-teal-700 hover:underline">
            Agent configuration
          </Link>
        </li>
        <li>
          <Link href="/account/admin/registrations" className="text-teal-700 hover:underline">
            Registrations
          </Link>
        </li>
      </ul>
    </div>
  );
}
