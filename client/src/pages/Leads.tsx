import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Plus, Edit2, Trash2, Loader2, X } from "lucide-react";

const emptyForm = { branchId: "", name: "", phone: "", email: "", source: "other", status: "new", notes: "" };
const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function Leads() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: leads = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/leads"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leads", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leads"] }); closeModal(); toast({ title: "Lead created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/leads/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leads"] }); closeModal(); toast({ title: "Lead updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/leads/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leads"] }); toast({ title: "Lead deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({ branchId: l.branchId || "", name: l.name, phone: l.phone || "", email: l.email || "", source: l.source || "other", status: l.status, notes: l.notes || "" });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, branchId: parseInt(form.branchId) || 1 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = (leads as any[]).filter(l => filterStatus === "all" || l.status === filterStatus);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Leads</h1>
          <p className="text-gray-500 text-sm mt-1">{leads.length} total leads</p>
        </div>
        <button onClick={openCreate} data-testid="button-add-lead"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4">
        {["all", "new", "contacted", "converted", "lost"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filterStatus === s ? "bg-primary text-white" : "bg-white border border-border text-gray-600 hover:bg-gray-50"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-gray-400">No leads found</div>
        ) : filtered.map((l: any) => (
          <div key={l.id} data-testid={`lead-card-${l.id}`} className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{l.name}</h3>
                <div className="text-xs text-gray-500 capitalize">{l.source?.replace("_", " ")}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[l.status] || "bg-gray-100 text-gray-600"}`}>{l.status}</span>
            </div>
            <div className="space-y-1.5 mb-3">
              {l.phone && <PhoneActions phone={l.phone} className="text-xs text-gray-600" phoneClassName="text-gray-600" />}
              {l.email && <EmailLink email={l.email} className="text-xs text-gray-600" />}
              {l.notes && <p className="text-xs text-gray-400 line-clamp-2">{l.notes}</p>}
            </div>
            <div className="flex gap-2 pt-3 border-t border-border">
              <button onClick={() => openEdit(l)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <div className="flex gap-1 ml-auto">
                {["contacted", "converted", "lost"].filter(s => s !== l.status).map(s => (
                  <button key={s} onClick={() => updateMutation.mutate({ id: l.id, data: { ...l, status: s } })}
                    className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s]} opacity-70 hover:opacity-100 transition-opacity capitalize`}>{s}</button>
                ))}
              </div>
              <button onClick={() => deleteMutation.mutate(l.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Lead" : "Add Lead"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select branch</option>
                  {(branches as any[]).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {[["name","Name","text","Full name"],["phone","Phone","tel",""],["email","Email","email",""]].map(([k,l,t,p]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{l}</label>
                  <input type={t} value={form[k]} placeholder={p} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === "name"}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["walk_in","social","website","referral","other"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["new","contacted","converted","lost"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
