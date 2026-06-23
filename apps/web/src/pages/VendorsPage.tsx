import { useState } from 'react';
import {
  contactFormSchema,
  serviceContractFormSchema,
  vendorFormSchema,
  type Contact,
  type ServiceContract,
  type Vendor,
} from '@cmc/shared';
import {
  useContacts,
  useCreateContact,
  useCreateServiceContract,
  useCreateVendor,
  useDeleteContact,
  useDeleteServiceContract,
  useDeleteVendor,
  useServiceContracts,
  useUpdateContact,
  useUpdateServiceContract,
  useUpdateVendor,
  useVendors,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, ExpiryBadge, Field, Modal, inputClass } from '../components/ui';

type Tab = 'vendors' | 'contracts' | 'contacts';

export function VendorsPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const [tab, setTab] = useState<Tab>('vendors');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'vendors', label: 'Vendors' },
    { key: 'contracts', label: 'Service Contracts' },
    { key: 'contacts', label: 'Contacts' },
  ];

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold text-slate-800">Vendors &amp; Contacts</h1>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-slate-800 font-medium text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vendors' && <VendorsTab canEdit={canEdit} />}
      {tab === 'contracts' && <ContractsTab canEdit={canEdit} />}
      {tab === 'contacts' && <ContactsTab canEdit={canEdit} />}
    </div>
  );
}

// ── Vendors ──────────────────────────────────────────────────────────────────
function VendorsTab({ canEdit }: { canEdit: boolean }) {
  const vendors = useVendors();
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const remove = useDeleteVendor();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setShow(true);
            }}
          >
            + New vendor
          </Button>
        )}
      </div>
      {vendors.data && vendors.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">COI expiry</th>
                <th className="px-4 py-2 font-medium">Contract expiry</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.data.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{v.name}</div>
                    {v.category && <div className="text-xs text-slate-400">{v.category}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {v.contact_name && <div>{v.contact_name}</div>}
                    <div className="text-xs text-slate-400">
                      {[v.phone, v.email].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {v.rate != null ? `$${v.rate}/hr` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <ExpiryBadge date={v.coi_expiry} />
                  </td>
                  <td className="px-4 py-2.5">
                    <ExpiryBadge date={v.contract_expiry} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(v);
                          setShow(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => confirm(`Delete "${v.name}"?`) && remove.mutate(v.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No vendors yet.</EmptyState>
      )}

      {show && (
        <VendorForm
          initial={editing}
          onClose={() => setShow(false)}
          onSubmit={async (values) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...values });
            else await create.mutateAsync(values);
            setShow(false);
          }}
        />
      )}
    </div>
  );
}

function VendorForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Vendor | null;
  onClose: () => void;
  onSubmit: (v: import('@cmc/shared').VendorForm) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? '',
    contact_name: initial?.contact_name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    rate: initial?.rate != null ? String(initial.rate) : '',
    coi_expiry: initial?.coi_expiry ?? '',
    contract_expiry: initial?.contract_expiry ?? '',
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title={initial ? 'Edit vendor' : 'New vendor'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = vendorFormSchema.safeParse(f);
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          await onSubmit(parsed.data);
          setBusy(false);
        }}
      >
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={f.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trade / category">
            <input className={inputClass} value={f.category} onChange={set('category')} />
          </Field>
          <Field label="Rate ($/hr)" error={errors.rate}>
            <input className={inputClass} value={f.rate} onChange={set('rate')} />
          </Field>
          <Field label="Contact name">
            <input className={inputClass} value={f.contact_name} onChange={set('contact_name')} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClass} value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={f.address} onChange={set('address')} />
          </Field>
          <Field label="COI expiry">
            <input type="date" className={inputClass} value={f.coi_expiry} onChange={set('coi_expiry')} />
          </Field>
          <Field label="Contract expiry">
            <input
              type="date"
              className={inputClass}
              value={f.contract_expiry}
              onChange={set('contract_expiry')}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
        <FormActions busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

// ── Service contracts ────────────────────────────────────────────────────────
function ContractsTab({ canEdit }: { canEdit: boolean }) {
  const contracts = useServiceContracts();
  const vendors = useVendors();
  const create = useCreateServiceContract();
  const update = useUpdateServiceContract();
  const remove = useDeleteServiceContract();
  const [editing, setEditing] = useState<ServiceContract | null>(null);
  const [show, setShow] = useState(false);
  const vendorName = (id: string | null) =>
    id ? (vendors.data?.find((v) => v.id === id)?.name ?? '—') : '—';

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setShow(true);
            }}
          >
            + New contract
          </Button>
        )}
      </div>
      {contracts.data && contracts.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Cadence</th>
                <th className="px-4 py-2 font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Ends</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{c.description}</td>
                  <td className="px-4 py-2.5 text-slate-600">{vendorName(c.vendor_id)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.cadence ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.cost != null ? `$${c.cost}${c.period_unit ? `/${c.period_unit}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <ExpiryBadge date={c.end_date} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setShow(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => confirm('Delete this contract?') && remove.mutate(c.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No service contracts yet.</EmptyState>
      )}

      {show && (
        <ContractForm
          initial={editing}
          vendors={(vendors.data ?? []).map((v) => ({ id: v.id, name: v.name }))}
          onClose={() => setShow(false)}
          onSubmit={async (values) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...values });
            else await create.mutateAsync(values);
            setShow(false);
          }}
        />
      )}
    </div>
  );
}

function ContractForm({
  initial,
  vendors,
  onClose,
  onSubmit,
}: {
  initial: ServiceContract | null;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: import('@cmc/shared').ServiceContractForm) => Promise<void>;
}) {
  const [f, setF] = useState({
    vendor_id: initial?.vendor_id ?? '',
    description: initial?.description ?? '',
    cadence: initial?.cadence ?? '',
    cost: initial?.cost != null ? String(initial.cost) : '',
    period_unit: initial?.period_unit ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    renewal_reminder_days:
      initial?.renewal_reminder_days != null ? String(initial.renewal_reminder_days) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title={initial ? 'Edit contract' : 'New service contract'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = serviceContractFormSchema.safeParse({ ...f, vendor_id: f.vendor_id || null });
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          await onSubmit(parsed.data);
          setBusy(false);
        }}
      >
        <Field label="Description" error={errors.description}>
          <input className={inputClass} value={f.description} onChange={set('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor">
            <select className={inputClass} value={f.vendor_id} onChange={set('vendor_id')}>
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cadence">
            <input className={inputClass} value={f.cadence} onChange={set('cadence')} placeholder="weekly" />
          </Field>
          <Field label="Cost" error={errors.cost}>
            <input className={inputClass} value={f.cost} onChange={set('cost')} />
          </Field>
          <Field label="Per">
            <input className={inputClass} value={f.period_unit} onChange={set('period_unit')} placeholder="month" />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} value={f.start_date} onChange={set('start_date')} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} value={f.end_date} onChange={set('end_date')} />
          </Field>
        </div>
        <FormActions busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────
function ContactsTab({ canEdit }: { canEdit: boolean }) {
  const contacts = useContacts();
  const create = useCreateContact();
  const update = useUpdateContact();
  const remove = useDeleteContact();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setShow(true);
            }}
          >
            + New contact
          </Button>
        )}
      </div>
      {contacts.data && contacts.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Org / role</th>
                <th className="px-4 py-2 font-medium">Phone / email</th>
                <th className="px-4 py-2 font-medium">Account #</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {[c.org, c.role].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.account_number ?? '—'}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setShow(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => confirm(`Delete "${c.name}"?`) && remove.mutate(c.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No contacts yet.</EmptyState>
      )}

      {show && (
        <ContactForm
          initial={editing}
          onClose={() => setShow(false)}
          onSubmit={async (values) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...values });
            else await create.mutateAsync(values);
            setShow(false);
          }}
        />
      )}
    </div>
  );
}

function ContactForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Contact | null;
  onClose: () => void;
  onSubmit: (v: import('@cmc/shared').ContactForm) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    org: initial?.org ?? '',
    role: initial?.role ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    account_number: initial?.account_number ?? '',
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title={initial ? 'Edit contact' : 'New contact'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = contactFormSchema.safeParse(f);
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          await onSubmit(parsed.data);
          setBusy(false);
        }}
      >
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={f.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Organization">
            <input className={inputClass} value={f.org} onChange={set('org')} />
          </Field>
          <Field label="Role">
            <input className={inputClass} value={f.role} onChange={set('role')} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClass} value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Account #">
            <input className={inputClass} value={f.account_number} onChange={set('account_number')} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
        <FormActions busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

function FormActions({ busy, onClose }: { busy: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
