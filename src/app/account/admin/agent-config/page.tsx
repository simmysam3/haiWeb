import Link from 'next/link';

export default function AgentConfigIndex() {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">Agent configuration</h2>
      <ul className="space-y-2">
        <li>
          <Link href="/account/admin/agent-config/sku-picker-scope" className="text-teal-700 hover:underline">
            SKU picker scope
          </Link>
        </li>
        <li>
          <Link href="/account/admin/agent-config/mes-integration" className="text-teal-700 hover:underline">
            MES integration
          </Link>
        </li>
      </ul>
    </div>
  );
}
