import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, X, Receipt, CreditCard } from "lucide-react";

const emptyPaymentForm = {
  memberId: "",
  branchId: "",
  invoiceId: "",
  amount: "",
  paymentType: "package_purchase",
  paymentMethod: "cash",
  status: "paid",
  notes: "",
  transactionRef: "",
};

const emptyInvoiceForm = {
  memberId: "",
  branchId: "",
  subscriptionId: "",
  invoiceType: "membership",
  subtotal: "",
  discountAmount: "0",
  taxAmount: "0",
  dueDate: "",
  notes: "",
};

export default function Payments() {
  const { toast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<any>(emptyPaymentForm);
  const [invoiceForm, setInvoiceForm] = useState<any>(emptyInvoiceForm);

  const { data: payments = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/payments"] });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["/api/invoices"] });
  const { data: members = [] } = useQuery<any[]>({ queryKey: ["/api/members"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: subscriptions = [] } = useQuery<any[]>({ queryKey: ["/api/subscriptions"] });

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowPaymentModal(false);
      setPaymentForm(emptyPaymentForm);
      toast({ title: "Payment recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setShowInvoiceModal(false);
      setInvoiceForm(emptyInvoiceForm);
      toast({ title: "Invoice created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPaymentMutation.mutate({
      ...paymentForm,
      memberId: parseInt(paymentForm.memberId, 10),
      branchId: parseInt(paymentForm.branchId, 10),
      invoiceId: paymentForm.invoiceId ? parseInt(paymentForm.invoiceId, 10) : null,
      amount: parseFloat(paymentForm.amount),
    });
  };

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInvoiceMutation.mutate({
      ...invoiceForm,
      memberId: parseInt(invoiceForm.memberId, 10),
      branchId: parseInt(invoiceForm.branchId, 10),
      subscriptionId: invoiceForm.subscriptionId ? parseInt(invoiceForm.subscriptionId, 10) : null,
      subtotal: parseFloat(invoiceForm.subtotal),
      discountAmount: parseFloat(invoiceForm.discountAmount || "0"),
      taxAmount: parseFloat(invoiceForm.taxAmount || "0"),
    });
  };

  const totalCollected = (payments as any[]).reduce((sum: number, payment: any) => sum + parseFloat(payment.amount || "0"), 0);
  const outstandingBalance = (invoices as any[]).reduce((sum: number, invoice: any) => sum + parseFloat(invoice.balanceDue || "0"), 0);
  const openInvoices = (invoices as any[]).filter((invoice: any) => Number(invoice.balanceDue || 0) > 0);

  const statusColor = (status: string) =>
    status === "paid"
      ? "bg-green-100 text-green-700"
      : status === "pending" || status === "partial"
        ? "bg-yellow-100 text-yellow-700"
        : status === "refunded"
          ? "bg-blue-100 text-blue-700"
          : "bg-red-100 text-red-700";

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & Billing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Collected: <span className="font-semibold text-gray-900">${totalCollected.toLocaleString()}</span> · Outstanding:{" "}
            <span className="font-semibold text-[#8a6b00]">${outstandingBalance.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d9cdb0] bg-white px-4 py-2 text-sm font-medium text-[#181818] transition-colors hover:bg-[#f8f4ea] sm:w-auto"
          >
            <Receipt className="h-4 w-4" /> Create Invoice
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            data-testid="button-add-payment"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Record Payment
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500"><CreditCard className="h-4 w-4" /> Payment Summary</div>
          <div className="text-2xl font-bold text-gray-900">${totalCollected.toLocaleString()}</div>
          <div className="mt-1 text-xs text-gray-500">{payments.length} payment records</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500"><Receipt className="h-4 w-4" /> Open Invoices</div>
          <div className="text-2xl font-bold text-gray-900">{openInvoices.length}</div>
          <div className="mt-1 text-xs text-gray-500">${outstandingBalance.toLocaleString()} outstanding</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500"><Receipt className="h-4 w-4" /> Issued Invoices</div>
          <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
          <div className="mt-1 text-xs text-gray-500">Membership, PT, class, and other billing</div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Outstanding Balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                {["Invoice", "Member", "Type", "Due Date", "Total", "Paid", "Balance", "Status"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {openInvoices.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No outstanding balances</td></tr>
              ) : (
                openInvoices.map((invoice: any) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3.5 text-gray-600">
                      <div>{invoice.memberName}</div>
                      <div className="text-xs text-gray-400">{invoice.branchName}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 capitalize">{String(invoice.invoiceType).replace(/_/g, " ")}</td>
                    <td className="px-4 py-3.5 text-gray-600">{invoice.dueDate || "-"}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-900">${Number(invoice.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-gray-600">${Number(invoice.amountPaid).toFixed(2)}</td>
                    <td className="px-4 py-3.5 font-semibold text-[#8a6b00]">${Number(invoice.balanceDue).toFixed(2)}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(invoice.status)}`}>{invoice.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {["Member", "Invoice", "Type", "Method", "Amount", "Status", "Date", "Notes"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(payments as any[]).length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No payments recorded</td></tr>
                ) : (
                  (payments as any[]).map((payment: any) => (
                    <tr key={payment.id} data-testid={`payment-row-${payment.id}`} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{payment.memberName}</div>
                        <div className="text-xs text-gray-500">{payment.branchName}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{payment.invoiceNumber || "-"}</td>
                      <td className="px-4 py-3.5 text-gray-600 capitalize">{String(payment.paymentType).replace(/_/g, " ")}</td>
                      <td className="px-4 py-3.5 text-gray-600">{payment.paymentMethod}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900">${Number(payment.amount).toFixed(2)}</td>
                      <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(payment.status)}`}>{payment.status}</span></td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}</td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-xs text-gray-500">{payment.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Create Invoice</h2>
              <button onClick={() => { setShowInvoiceModal(false); setInvoiceForm(emptyInvoiceForm); }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleInvoiceSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
                <select value={invoiceForm.memberId} onChange={(e) => setInvoiceForm({ ...invoiceForm, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select member</option>
                  {(members as any[]).map((member: any) => <option key={member.id} value={member.id}>{member.userName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                  <select value={invoiceForm.branchId} onChange={(e) => setInvoiceForm({ ...invoiceForm, branchId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                    <option value="">Select branch</option>
                    {(branches as any[]).map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Type</label>
                  <select value={invoiceForm.invoiceType} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceType: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="membership">Membership</option>
                    <option value="personal_training">Personal Training</option>
                    <option value="class_extra">Class Extra</option>
                    <option value="product">Product</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Subscription</label>
                <select value={invoiceForm.subscriptionId} onChange={(e) => setInvoiceForm({ ...invoiceForm, subscriptionId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No subscription linked</option>
                  {(subscriptions as any[]).map((subscription: any) => <option key={subscription.id} value={subscription.id}>{subscription.memberName} - {subscription.packageName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Subtotal</label>
                  <input type="number" step="0.01" value={invoiceForm.subtotal} onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Discount</label>
                  <input type="number" step="0.01" value={invoiceForm.discountAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, discountAmount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Tax</label>
                  <input type="number" step="0.01" value={invoiceForm.taxAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Due Date</label>
                <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <input type="text" value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowInvoiceModal(false); setInvoiceForm(emptyInvoiceForm); }} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createInvoiceMutation.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => { setShowPaymentModal(false); setPaymentForm(emptyPaymentForm); }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
                <select value={paymentForm.memberId} onChange={(e) => setPaymentForm({ ...paymentForm, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select member</option>
                  {(members as any[]).map((member: any) => <option key={member.id} value={member.id}>{member.userName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                <select value={paymentForm.branchId} onChange={(e) => setPaymentForm({ ...paymentForm, branchId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <option value="">Select branch</option>
                  {(branches as any[]).map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Invoice</label>
                <select value={paymentForm.invoiceId} onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No invoice linked</option>
                  {openInvoices.map((invoice: any) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.memberName} (${Number(invoice.balanceDue).toFixed(2)} due)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Amount ($)</label>
                  <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Method</label>
                  <select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Payment Type</label>
                <select value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="package_purchase">Package Purchase</option>
                  <option value="class_extra">Class Extra</option>
                  <option value="product_purchase">Product Purchase</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Transaction Ref</label>
                <input type="text" value={paymentForm.transactionRef} onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <input type="text" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPaymentModal(false); setPaymentForm(emptyPaymentForm); }} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createPaymentMutation.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createPaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
