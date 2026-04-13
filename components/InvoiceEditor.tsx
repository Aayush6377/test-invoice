"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useReactToPrint } from "react-to-print";

interface InvoiceFormProps {
  initialData?: any;
  mode: "create" | "update";
  invoiceId?: string;
}

export default function InvoiceForm({ initialData, mode, invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialData?.logoUrl || initialData?.senderLogoUrl || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [invoice, setInvoice] = useState(initialData || {
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    title: "INVOICE",
    senderName: "",
    senderAddress: "",
    senderCity: "",
    senderState: "",
    senderZip: "",
    senderCountry: "India",
    clientId: "",
    clientName: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientZip: "",
    clientCountry: "India",
    notesTitle: "Notes & Payment Instructions",
    notes: "Please include the invoice number in your payment reference.",
    termsTitle: "Terms & Conditions",
    terms: "Payment is due within 15 days. Late payments may be subject to additional fees.",
    includeQrCode: false,
    paymentUpiId: "",
    items: [{ description: "Web Development Services", quantity: 1, rate: 0, taxRate: 0 }]
  });

  // Fetch Defaults
  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const [profileRes, paymentRes, clientsRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/user/payment"),
          fetch("/api/user/clients")
        ]);

        const profileData = profileRes.ok ? await profileRes.json() : {};
        const paymentData = paymentRes.ok ? await paymentRes.json() : {};
        const clientsData = clientsRes.ok ? await clientsRes.json() : { clients: [] };

        const user = profileData.profile || {};
        const payment = paymentData.paymentDetails || {};
        
        setClients(clientsData.clients || []);
        
        if (mode === "create") {
          if (user.logoUrl) setLogoPreview(user.logoUrl);
          setInvoice((prev: any) => ({
            ...prev,
            senderName: user.companyName || user.name || "",
            senderAddress: user.companyAddress || "",
            senderCity: user.city || "",
            senderState: user.state || "",
            senderZip: user.zip || "",
            senderCountry: user.country || "India",
            paymentUpiId: payment.upiId || "",
          }));
        }
      } catch (error) {
        console.error("Failed to load defaults", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDefaults();
  }, [mode]);

  const handleDownloadPDF = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `${invoice.invoiceNumber}`,
    pageStyle: `@page { size: A4 portrait; margin: 0; } @media print { body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
  });

  // Trigger Auto-Download if param exists
  useEffect(() => {
    if (!loading && searchParams.get("download") === "true") {
      handleDownloadPDF();
    }
  }, [loading, searchParams, handleDownloadPDF]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("client")) {
        setInvoice((prev: any) => ({ ...prev, [name]: value, clientId: "" }));
    } else {
        setInvoice((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setInvoice((prev: any) => ({ ...prev, clientId: "", clientName: "", clientAddress: "", clientCity: "", clientState: "", clientZip: "", clientCountry: "India" }));
      return;
    }
    const client = clients.find(c => c.id === selectedId);
    if (client) {
      setInvoice((prev: any) => ({
        ...prev,
        clientId: client.id,
        clientName: client.companyName || "",
        clientAddress: client.address || "",
        clientCity: client.city || "",
        clientState: client.state || "",
        clientZip: client.zip || "",
        clientCountry: client.country || "India",
      }));
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...invoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoice((prev: any) => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setInvoice((prev: any) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, rate: 0, taxRate: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    if (invoice.items.length === 1) return;
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice((prev: any) => ({ ...prev, items: newItems }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const totals = invoice.items.reduce((acc: any, item: any) => {
    const base = item.quantity * item.rate;
    const tax = base * (item.taxRate / 100);
    return { subTotal: acc.subTotal + base, taxTotal: acc.taxTotal + tax, total: acc.total + base + tax };
  }, { subTotal: 0, taxTotal: 0, total: 0 });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      const dataToSave = { 
        ...invoice,
        clientId: invoice.clientId === "" ? null : invoice.clientId,
        notesTitle: !invoice.notes ? "" : invoice.notesTitle,
        termsTitle: !invoice.terms ? "" : invoice.termsTitle,
      };

      formData.append("data", JSON.stringify(dataToSave));
      if (logoFile) formData.append("logo", logoFile);

      const url = mode === "create" ? "/api/user/invoices" : `/api/user/invoices/${invoiceId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();
      
      if (res.ok) {
        alert(mode === "create" ? "Invoice Saved!" : "Invoice Updated!");
        router.push("/user/invoices");
      } else {
        alert(data.message || data.error);
      }
    } catch (error) {
      console.error("Save error", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    setIsDeleting(true);
    try {
        const res = await fetch(`/api/user/invoices/${invoiceId}`, { method: "DELETE" });
        if (res.ok) {
            router.push("/user/invoices");
        }
    } catch (error) { 
      console.error(error); 
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEmail = async () => {
    alert("Email send test");
  }

  const inputStyles = "bg-transparent hover:bg-slate-50 focus:bg-blue-50 hover:outline hover:outline-1 hover:outline-slate-300 focus:outline focus:outline-2 focus:outline-blue-500/40 rounded transition-all px-1 -mx-1 w-full";

  if (loading) return <div className="p-20 text-center font-medium text-slate-500">Loading Editor...</div>;

  return (
    <div className="h-full overflow-y-auto bg-[#f3f4f6] text-slate-900 pb-32 relative">
      <header className="sticky top-0 w-full z-40 bg-white/80 backdrop-blur-xl shadow-sm flex justify-between items-center px-8 h-16">
        <div className="flex items-center gap-6">
          <Link href="/user" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Dashboard
          </Link>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <span className="text-lg font-black tracking-tight">{mode === "create" ? "New Invoice" : "Update Invoice"}</span>
        </div>
      </header>

      <main className="pt-8 flex flex-col items-center px-4">
        <div className="w-full max-w-[850px] mb-6 flex justify-end">
          <select 
            onChange={handleClientSelect}
            className="bg-white border border-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm"
          >
            <option value="">-- Auto-fill from Saved Clients --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
        </div>

        <article ref={invoiceRef} className="w-full max-w-[850px] min-h-[1050px] print:min-h-0 bg-white shadow-xl print:shadow-none rounded-sm p-16 flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-start mb-16">
            <div className="space-y-4 max-w-[50%]">
              <label className="cursor-pointer block w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>

              <div className="space-y-1">
                <input name="senderName" value={invoice.senderName} onChange={handleChange} placeholder="Your Company Name" className={`${inputStyles} font-bold text-xl`} />
                <textarea name="senderAddress" value={invoice.senderAddress} onChange={handleChange} placeholder="Address" className={`${inputStyles} text-sm text-slate-600 resize-none h-6`} />
                <div className="flex gap-2">
                  <input name="senderCity" value={invoice.senderCity} onChange={handleChange} placeholder="City" className={`${inputStyles} text-sm text-slate-600`} />
                  <input name="senderState" value={invoice.senderState} onChange={handleChange} placeholder="State" className={`${inputStyles} text-sm text-slate-600`} />
                </div>
              </div>
            </div>

            <div className="text-right space-y-4 w-64">
              <input name="title" value={invoice.title} onChange={handleChange} className={`${inputStyles} text-5xl font-black text-slate-200 text-right uppercase`} />
              <div className="space-y-2">
                <div className="flex justify-end items-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Invoice No.</span>
                  <input name="invoiceNumber" value={invoice.invoiceNumber} onChange={handleChange} className={`${inputStyles} font-mono font-bold text-right w-32`} />
                </div>
                <div className="flex justify-end items-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Issue Date</span>
                  <input type="date" name="issueDate" value={invoice.issueDate} onChange={handleChange} className={`${inputStyles} font-medium text-right w-36`} />
                </div>
                <div className="flex justify-end items-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Due Date</span>
                  <input type="date" name="dueDate" value={invoice.dueDate} onChange={handleChange} className={`${inputStyles} font-medium text-right w-36`} />
                </div>
              </div>
            </div>
          </div>

          {/* Billing Info */}
          <div className="mb-12">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-blue-600 mb-2">Bill To</h3>
            <div className="max-w-[50%] space-y-1">
              <input name="clientName" value={invoice.clientName} onChange={handleChange} placeholder="Client Name" className={`${inputStyles} font-bold text-lg`} />
              <textarea name="clientAddress" value={invoice.clientAddress} onChange={handleChange} placeholder="Client Address" className={`${inputStyles} text-sm text-slate-600 resize-none h-6`} />
              <div className="flex gap-2">
                <input name="clientCity" value={invoice.clientCity} onChange={handleChange} placeholder="City" className={`${inputStyles} text-sm text-slate-600`} />
                <input name="clientState" value={invoice.clientState} onChange={handleChange} placeholder="State" className={`${inputStyles} text-sm text-slate-600`} />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-10">
            <div className="flex border-b border-slate-200 pb-2 mb-2 text-[10px] uppercase tracking-widest font-bold text-slate-500">
              <div className="flex-1 px-2">Description</div>
              <div className="w-20 text-center">Qty</div>
              <div className="w-24 text-right">Rate</div>
              <div className="w-20 text-center">Tax %</div>
              <div className="w-32 text-right px-2">Amount</div>
              <div className="w-10 print:hidden"></div>
            </div>

            {invoice.items.map((item: any, index: number) => (
              <div key={index} className="flex items-start py-2 border-b border-slate-100 group">
                <div className="flex-1 px-2">
                  <textarea value={item.description} onChange={(e) => handleItemChange(index, "description", e.target.value)} placeholder="Item description" className={`${inputStyles} font-semibold resize-none h-8`} />
                </div>
                <div className="w-20 px-1">
                  <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} className={`${inputStyles} text-center`} />
                </div>
                <div className="w-24 px-1">
                  <input type="number" value={item.rate} onChange={(e) => handleItemChange(index, "rate", Number(e.target.value))} className={`${inputStyles} text-right`} />
                </div>
                <div className="w-20 px-1">
                  <input type="number" value={item.taxRate} onChange={(e) => handleItemChange(index, "taxRate", Number(e.target.value))} className={`${inputStyles} text-center`} />
                </div>
                <div className="w-32 text-right px-2 py-1 font-bold">
                  ₹{((item.quantity * item.rate) * (1 + item.taxRate / 100)).toFixed(2)}
                </div>
                <div className="w-10 flex justify-center py-1 print:hidden">
                  <button onClick={() => removeItem(index)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addItem} className="mt-4 flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all text-sm font-semibold print:hidden">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Line Item
            </button>
          </div>

          {/* Totals & Notes */}
          <div className="mt-auto pt-8 border-t border-slate-200 flex flex-col gap-8 break-inside-avoid">
            <div className="flex justify-between items-start">
              <div className="w-1/2 space-y-6">
                <div className={!invoice.notes ? "print:hidden" : ""}>
                  <input name="notesTitle" value={invoice.notesTitle} onChange={handleChange} placeholder="Notes Title" className={`${inputStyles} text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1`} />
                  <textarea name="notes" value={invoice.notes} onChange={handleChange} placeholder="Add notes here..." className={`${inputStyles} text-sm text-slate-600 resize-none h-16`} />
                </div>
                <div className={!invoice.terms ? "print:hidden" : ""}>
                  <input name="termsTitle" value={invoice.termsTitle} onChange={handleChange} placeholder="Terms Title" className={`${inputStyles} text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1`} />
                  <textarea name="terms" value={invoice.terms} onChange={handleChange} placeholder="Terms..." className={`${inputStyles} text-[11px] text-slate-500 italic resize-none h-12`} />
                </div>
              </div>

              <div className="w-[40%] space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold">₹{totals.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-semibold">₹{totals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-200">
                  <span className="text-xs uppercase tracking-widest font-black text-slate-800">Total</span>
                  <span className="text-2xl font-black text-blue-600">₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 print:hidden">
                  <input type="checkbox" id="qrToggle" checked={invoice.includeQrCode} onChange={(e) => setInvoice((prev: any) => ({ ...prev, includeQrCode: e.target.checked }))} className="w-4 h-4 text-blue-600 cursor-pointer" />
                  <label htmlFor="qrToggle" className="text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">Enable UPI QR</label>
                </div>
                {invoice.includeQrCode && invoice.paymentUpiId && (
                  <div className="flex items-center gap-5 p-4 border-2 border-blue-100 bg-blue-50/40 rounded-xl w-max">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <QRCodeSVG value={`upi://pay?pa=${invoice.paymentUpiId}&pn=${encodeURIComponent(invoice.senderName)}&am=${totals.total.toFixed(2)}&cu=INR`} size={84} level="H" />
                    </div>
                    <div className="flex flex-col justify-center pr-2">
                       <span className="text-[10px] font-extrabold uppercase text-blue-600">Scan to Pay</span>
                       <span className="text-sm font-bold">{invoice.senderName}</span>
                       <span className="text-[11px] font-mono text-slate-500">{invoice.paymentUpiId}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right pb-2">
                <p className="text-xl font-bold text-slate-300 italic">Thank you for your business.</p>
              </div>
            </div>
          </div>
        </article>
      </main>

      <footer className="fixed bottom-0 left-0 w-full min-h-20 bg-white/90 backdrop-blur-md border-t border-slate-200 px-4 md:px-8 py-4 flex flex-wrap md:flex-nowrap justify-center md:justify-end items-center z-50 gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {mode === "update" && (
            <button 
              disabled={isDeleting || isSaving}
              onClick={handleDelete} 
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
            >
                <span className="material-symbols-outlined text-lg">delete</span>
                {isDeleting ? "Deleting..." : "Delete"}
            </button>
        )}
        
        <button onClick={handleEmail} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
          <span className="material-symbols-outlined text-lg">mail</span>
          Send Email
        </button>

        <button onClick={() => handleDownloadPDF()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
          <span className="material-symbols-outlined text-lg">download</span>
          Download PDF
        </button>

        <button 
          disabled={isSaving || isDeleting}
          onClick={handleSave} 
          className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {isSaving ? (mode === "create" ? "Saving..." : "Updating...") : (mode === "create" ? "Save Invoice" : "Update Invoice")}
        </button>
      </footer>
    </div>
  );
}