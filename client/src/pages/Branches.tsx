import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit2, Trash2, Loader2, X } from "lucide-react";

interface Branch {
  id: number;
  name: string;
  location: string;
  phone: string;
  secondaryPhone?: string;
  secondary_phone?: string;
  mobile?: string;
  email: string;
  status: string;
}

const defaultLebanonPhone = "+961";
const emptyForm = {
  name: "",
  location: "",
  phone: defaultLebanonPhone,
  secondaryPhone: defaultLebanonPhone,
  mobile: defaultLebanonPhone,
  email: "",
  status: "active",
};

export default function Branches() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/branches", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/branches"] }); closeModal(); toast({ title: "Branch created" }); },
    onError: () => toast({ title: "Error", description: "Failed to create branch", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/branches/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/branches"] }); closeModal(); toast({ title: "Branch updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update branch", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setBranchToDelete(null);
      toast({ title: "Branch deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete branch", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      location: b.location,
      phone: b.phone || defaultLebanonPhone,
      secondaryPhone: b.secondaryPhone || b.secondary_phone || defaultLebanonPhone,
      mobile: b.mobile || defaultLebanonPhone,
      email: b.email || "",
      status: b.status,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-500 text-sm mt-1">Manage gym locations</p>
        </div>
        <button onClick={openCreate} data-testid="button-add-branch"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-400">No branches yet. Add your first branch.</div>
          ) : branches.map((b) => (
            <div key={b.id} data-testid={`branch-card-${b.id}`} className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {b.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{b.name}</h3>
              <p className="text-sm text-gray-500 mb-1">{b.location}</p>
              {b.phone && <PhoneActions phone={b.phone} className="text-xs text-gray-400" phoneClassName="text-gray-400" actionClassName="text-green-600" />}
              {(b.secondaryPhone || b.secondary_phone) && (
                <PhoneActions
                  phone={b.secondaryPhone || b.secondary_phone}
                  className="text-xs text-gray-400"
                  phoneClassName="text-gray-400"
                  actionClassName="text-green-600"
                />
              )}
              {b.mobile && <PhoneActions phone={b.mobile} className="text-xs text-gray-400" phoneClassName="text-gray-400" actionClassName="text-green-600" />}
              {b.email && <EmailLink email={b.email} className="text-xs text-gray-400" />}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <button onClick={() => openEdit(b)} data-testid={`button-edit-branch-${b.id}`}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => setBranchToDelete(b)} data-testid={`button-delete-branch-${b.id}`}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Branch" : "Add Branch"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {[
                { label: "Branch Name", key: "name", type: "text", placeholder: "e.g. Downtown Branch" },
                { label: "Location", key: "location", type: "text", placeholder: "e.g. 123 Main St, City" },
                { label: "Phone", key: "phone", type: "tel", placeholder: "+961" },
                { label: "Another Phone", key: "secondaryPhone", type: "tel", placeholder: "+961" },
                { label: "Mobile", key: "mobile", type: "tel", placeholder: "+961" },
                { label: "Email", key: "email", type: "email", placeholder: "branch@gym.com" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <input type={type} value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    required={key === "name" || key === "location"} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {branchToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Delete Branch</h2>
              <button onClick={() => setBranchToDelete(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{branchToDelete.name}</span>?
              </p>
              <p className="mt-2 text-xs text-gray-400">This action cannot be undone.</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBranchToDelete(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(branchToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Branch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
