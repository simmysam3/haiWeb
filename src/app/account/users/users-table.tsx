"use client";

import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import type { MockUser } from "@/lib/mock-types";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";
import { RoleSelect } from "./role-select";

const FIELD_CLASS =
  "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";

export function UsersTable() {
  const { data: apiUsers, loading, error, refetch } = useApi<MockUser[]>({ url: "/api/account/users", fallback: [] });
  const [users, setUsers] = useState<MockUser[]>(apiUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<MockUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("buyer_view_only");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const { toast, showToast } = useToast();

  function openEdit(u: MockUser) {
    setActionError(null);
    setEditUser(u);
    setEditFirstName(u.first_name);
    setEditLastName(u.last_name);
    setEditRole(u.role);
  }
  function closeEdit() {
    setEditUser(null);
    setActionError(null);
  }
  function openDeactivate(u: MockUser) {
    setActionError(null);
    setDeactivateUser(u);
  }
  function closeDeactivate() {
    setDeactivateUser(null);
    setActionError(null);
  }
  function openDelete(u: MockUser) {
    setActionError(null);
    setDeleteTarget(u);
  }
  function closeDelete() {
    setDeleteTarget(null);
    setActionError(null);
  }

  useEffect(() => {
    setUsers(apiUsers);
  }, [apiUsers]);

  function closeInvite() {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteError(null);
  }

  async function handleInvite() {
    setInviteError(null);
    // The BFF requires all three; without them the invite 400s. Validate up
    // front rather than firing a request we know will fail.
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      setInviteError("Email, first name, and last name are all required.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/account/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        // Surface the real BFF error; do NOT add an optimistic row for a user
        // that was never created.
        const body = await res.json().catch(() => ({}));
        setInviteError(body.error ?? `Could not send the invitation (${res.status}).`);
        return;
      }
      const created = await res.json();
      const newUser: MockUser = {
        id: created.id,
        email: created.email ?? inviteEmail,
        first_name: created.first_name ?? inviteFirstName,
        last_name: created.last_name ?? inviteLastName,
        role: (created.role ?? inviteRole) as MockUser["role"],
        job_title: "",
        phone: "",
        status: "active",
        last_login: "Never",
      };
      setUsers((prev) => [...prev, newUser]);
      showToast(`Invitation sent to ${newUser.email}`);
      closeInvite();
      // Re-read the roster: the realm role is the governing record (D-212), so
      // the row must show the role the list endpoint resolves, not the one this
      // request echoed back. The refetch also supersedes an initial load still
      // in flight — useApi cancels it — so a roster that predates the invite can
      // no longer land and wipe the row just appended (§L-29).
      refetch();
    } catch {
      setInviteError("Could not reach the server. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  // Only what differs from the row travels: an unchanged role must not trigger
  // the remove-then-add cycle (D-212), and the email never travels at all.
  function editChanges(u: MockUser): Record<string, string> {
    const changes: Record<string, string> = {};
    const first = editFirstName.trim();
    const last = editLastName.trim();
    if (first !== u.first_name || last !== u.last_name) {
      changes.first_name = first;
      changes.last_name = last;
    }
    if (editRole !== u.role) changes.role = editRole;
    return changes;
  }
  // Both names must survive the trim: the BFF requires them together and
  // non-empty, so a Save that could only 400 is never offered.
  const editDirty = editUser
    ? Object.keys(editChanges(editUser)).length > 0 && editFirstName.trim() !== "" && editLastName.trim() !== ""
    : false;

  async function handleEdit() {
    if (!editUser) return;
    const changes = editChanges(editUser);
    if (Object.keys(changes).length === 0) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/account/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not update the user (${res.status}).`);
        return;
      }
      // The response carries only what was applied; the role is the governing
      // one (D-212), which may differ from the one requested.
      const applied = await res.json().catch(() => ({}));
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? {
        ...u,
        first_name: applied.first_name ?? u.first_name,
        last_name: applied.last_name ?? u.last_name,
        role: (applied.role ?? u.role) as MockUser["role"],
      } : u)));
      showToast("User updated");
      closeEdit();
      // Re-read the roster so a load still in flight (an invite's re-read, a
      // late initial load) can never revert the saved name or role (§L-29 shape).
      refetch();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateUser) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/account/users/${deactivateUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not deactivate the user (${res.status}).`);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === deactivateUser.id ? { ...u, status: "disabled" as const } : u)));
      showToast("User deactivated");
      closeDeactivate();
      // Re-read so an in-flight load can never show the user as active again.
      refetch();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    setActionBusy(true);
    try {
      // The body names the user: the BFF deletes only a user it was told about
      // by email, so a mis-targeted or stale request fails closed.
      const res = await fetch(`/api/account/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteTarget.email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not delete the user (${res.status}).`);
        return;
      }
      // An older server instance reached mid-deploy answers this DELETE by
      // disabling and returns { success, user_id } without `deleted` — the row
      // must not vanish and the toast must not say "deleted" in that case.
      const body = await res.json().catch(() => ({}));
      if (body.deleted !== true) {
        setActionError("The user was not deleted. Reload the page and try again.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast("User deleted");
      closeDelete();
      // Re-read so an in-flight load can never resurrect the deleted row.
      refetch();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
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
          <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
            Edit
          </Button>
          {u.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => openDeactivate(u)}>
              Deactivate
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openDelete(u)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Rendered in both branches. A successful invite closes its dialog, so if the
  // re-read that follows fails the outage panel would be the only thing left on
  // the page and the user would read it as a failed invite and re-invite.
  const toastBanner = toast && (
    <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
      {toast}
    </div>
  );

  const actionErrorBanner = actionError && (
    <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
      {actionError}
    </div>
  );

  // A load failure must read as an outage, not as "this account has no users".
  if (error && !loading) {
    return (
      <>
        {toastBanner}
        <div className="bg-white rounded-lg border border-slate/15 p-8 text-center">
          <p className="text-sm font-medium text-problem">Could not load users.</p>
          <p className="mt-1 text-sm text-slate">There was a problem reaching the identity service. Your team members are safe — this is a display issue.</p>
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={refetch}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toastBanner}

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15 flex justify-between items-center">
          <p className="text-sm text-slate">{users.length} users</p>
          <Button size="sm" onClick={() => setInviteOpen(true)}>Invite User</Button>
        </div>
        <DataTable columns={columns} data={users} keyFn={(u) => u.id} />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={closeInvite} title="Invite User">
        <div className="space-y-4">
          {inviteError && (
            <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
              {inviteError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-first-name" className="block text-sm font-medium text-charcoal mb-1">First Name</label>
              <input
                id="invite-first-name"
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Jordan"
              />
            </div>
            <div>
              <label htmlFor="invite-last-name" className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
              <input
                id="invite-last-name"
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Reyes"
              />
            </div>
          </div>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={FIELD_CLASS}
              placeholder="user@company.com"
            />
          </div>
          <RoleSelect id="invite-role" value={inviteRole} onChange={setInviteRole} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeInvite}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={closeEdit} title="Edit User">
        <div className="space-y-4">
          {actionErrorBanner}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-first-name" className="block text-sm font-medium text-charcoal mb-1">First Name</label>
              <input
                id="edit-first-name"
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="edit-last-name" className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
              <input
                id="edit-last-name"
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              id="edit-email"
              type="email"
              value={editUser?.email ?? ""}
              disabled
              readOnly
              aria-describedby="edit-email-note"
              className={`${FIELD_CLASS} bg-light-gray text-slate`}
            />
            <p id="edit-email-note" className="mt-1 text-xs text-slate">
              Email can&apos;t be changed. If it&apos;s wrong, delete this user and invite them again.
            </p>
          </div>
          <RoleSelect id="edit-role" value={editRole} onChange={setEditRole} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeEdit}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionBusy || !editDirty}>{actionBusy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateUser} onClose={closeDeactivate} title="Deactivate User">
        {actionError && (
          <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
            {actionError}
          </div>
        )}
        <p className="text-sm text-charcoal mb-4">
          Are you sure you want to deactivate <strong>{deactivateUser?.first_name} {deactivateUser?.last_name}</strong>? They will lose access to the portal.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={closeDeactivate}>Cancel</Button>
          <Button variant="danger" onClick={handleDeactivate} disabled={actionBusy}>{actionBusy ? "Deactivating…" : "Deactivate"}</Button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={closeDelete} title="Delete User">
        {actionError && (
          <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
            {actionError}
          </div>
        )}
        <p className="text-sm text-charcoal mb-4">
          Permanently delete <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> ({deleteTarget?.email})?
          They lose access immediately and the account can&apos;t be restored. To bring them back, invite them again.
          Records of what they did in this account are kept.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={closeDelete}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={actionBusy}>{actionBusy ? "Deleting…" : "Delete"}</Button>
        </div>
      </Modal>
    </>
  );
}
