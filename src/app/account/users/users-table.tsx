"use client";

import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { MOCK_USERS, MockUser } from "@/lib/mock-data";
import { useApi } from "@/lib/use-api";

const ROLES = [
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
] as const;

const ROLE_LABELS: Record<string, string> = {
  procurement_read_only: "Procurement Read Only",
  procurement_transact: "Procurement Transact",
  buyer_view_only: "Buyer View Only",
  buyer_request_quote: "Buyer Request Quote",
  buyer_full_transact: "Buyer Full Transact",
  inside_sales_read_only: "Inside Sales Read Only",
  inside_sales_transact: "Inside Sales Transact",
};

export function UsersTable() {
  const { data: apiUsers } = useApi<MockUser[]>({ url: "/api/account/users", fallback: MOCK_USERS });
  const [users, setUsers] = useState<MockUser[]>(apiUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<MockUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("buyer_view_only");
  const [editRole, setEditRole] = useState<string>("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setUsers(apiUsers);
  }, [apiUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleInvite() {
    if (!inviteEmail) return;
    const newUser: MockUser = {
      id: `u-${Date.now()}`,
      email: inviteEmail,
      first_name: "Invited",
      last_name: "User",
      role: inviteRole as MockUser["role"],
      job_title: "",
      phone: "",
      status: "active",
      last_login: "Never",
    };
    setUsers([...users, newUser]);
    setInviteOpen(false);
    setInviteEmail("");
    showToast(`Invitation sent to ${inviteEmail}`);

    fetch("/api/account/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    }).catch(() => {});
  }

  function handleEditRole() {
    if (!editUser || !editRole) return;
    setUsers(users.map((u) => u.id === editUser.id ? { ...u, role: editRole as MockUser["role"] } : u));
    const userId = editUser.id;
    setEditUser(null);
    showToast("Role updated");

    fetch(`/api/account/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole }),
    }).catch(() => {});
  }

  function handleDeactivate() {
    if (!deactivateUser) return;
    setUsers(users.map((u) => u.id === deactivateUser.id ? { ...u, status: "disabled" as const } : u));
    const userId = deactivateUser.id;
    setDeactivateUser(null);
    showToast("User deactivated");

    fetch(`/api/account/users/${userId}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  const columns: Column<MockUser>[] = [
    {
      key: "name",
      label: "Name",
      render: (u) => (
        <div>
          <p className="font-medium text-charcoal">{u.first_name} {u.last_name}</p>
          <p className="text-xs text-slate">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (u) => <StatusBadge status={u.role} />,
    },
    {
      key: "status",
      label: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "last_login",
      label: "Last Login",
      render: (u) => <span className="text-slate">{u.last_login === "Never" ? "Never" : new Date(u.last_login).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (u) => u.role === "account_owner" ? null : (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditUser(u); setEditRole(u.role); }}>
            Edit Role
          </Button>
          {u.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => setDeactivateUser(u)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15 flex justify-between items-center">
          <p className="text-sm text-slate">{users.length} users</p>
          <Button size="sm" onClick={() => setInviteOpen(true)}>Invite User</Button>
        </div>
        <DataTable columns={columns} data={users} keyFn={(u) => u.id} />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite}>Send Invitation</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit Role">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Change role for <strong>{editUser?.first_name} {editUser?.last_name}</strong>
          </p>
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditRole}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateUser} onClose={() => setDeactivateUser(null)} title="Deactivate User">
        <p className="text-sm text-charcoal mb-4">
          Are you sure you want to deactivate <strong>{deactivateUser?.first_name} {deactivateUser?.last_name}</strong>? They will lose access to the portal.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeactivateUser(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeactivate}>Deactivate</Button>
        </div>
      </Modal>
    </>
  );
}
