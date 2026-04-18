"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Info, ExternalLink, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { useReactToPrint } from "react-to-print";

const themes = [
  { name: "black", color: "bg-black" },
  { name: "orange", color: "bg-orange-500" },
  { name: "blue", color: "bg-blue-600" },
  { name: "green", color: "bg-green-500" },
  { name: "red", color: "bg-red-600" },
];

const templates = [
  { name: "Standard", active: true },
  { name: "Spreadsheet" },
  { name: "Compact" },
  { name: "+80 more templates" },
];

const InlineInput = ({ className, emptyHidePrint, ...props }: any) => (
  <input
    className={cn(
      "bg-transparent hover:bg-slate-50 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded transition-colors px-1 -mx-1 w-full placeholder-gray-400 print:placeholder-transparent",
      emptyHidePrint && !props.value ? "print:hidden" : "",
      className
    )}
    {...props}
  />
);

const InlineTextarea = ({ className, emptyHidePrint, ...props }: any) => (
  <textarea
    className={cn(
      "bg-transparent hover:bg-slate-50 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded transition-colors px-1 -mx-1 w-full resize-none placeholder-gray-400 print:placeholder-transparent",
      emptyHidePrint && !props.value ? "print:hidden" : "",
      className
    )}
    {...props}
  />
);

export default function InvoiceLayout() {
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [currentColor, setCurrentColor] = useState(themes[0]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSavedUpi, setHasSavedUpi] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [invoice, setInvoice] = useState({
    title: "INVOICE",
    senderCompany: "",
    senderName: "",
    senderAddress: "",
    senderCityZip: "",
    senderCountry: "",
    clientCompany: "",
    clientName: "",
    clientAddress: "",
    clientCityZip: "",
    clientCountry: "",
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    items: [{ description: "", quantity: 1, rate: 0 }],
    taxRate: 12,
    notesTitle: "Notes",
    notes: "It was great doing business with you.",
    termsTitle: "Terms & Conditions",
    terms: "Please make the payment by the due date.",
    paymentUpiId: "",
    includeQrCode: false,
  });

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const [profileRes, paymentRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/user/payment"),
        ]);

        if (profileRes.ok) {
          setIsLoggedIn(true);
          const profileData = await profileRes.json();
          const user = profileData.profile || {};
          
          if (user.logoUrl) setLogoPreview(user.logoUrl);
          
          setInvoice((prev) => ({
            ...prev,
            senderCompany: user.companyName || "",
            senderName: user.name || "",
            senderAddress: user.companyAddress || "",
            senderCityZip: `${user.city || ""} ${user.zip || ""}`.trim(),
            senderCountry: user.country || "U.S.A",
          }));
        }

        if (paymentRes.ok) {
          const paymentData = await paymentRes.json();
          if (paymentData.paymentDetails?.upiId) {
            setHasSavedUpi(true);
            setInvoice((prev) => ({
              ...prev,
              paymentUpiId: paymentData.paymentDetails.upiId,
              includeQrCode: true,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load user defaults", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDefaults();
  }, []);

  const handleDownloadPDF = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: invoice.invoiceNumber,
    pageStyle: `@page { size: A4 portrait; margin: 10mm; } @media print { body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoice((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...invoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoice((prev) => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, rate: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    if (invoice.items.length === 1) return;
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const subTotal = invoice.items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const taxTotal = subTotal * (invoice.taxRate / 100);
  const total = subTotal + taxTotal;

  const handleSave = async (): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify(invoice));
      if (logoFile) formData.append("logo", logoFile);

      const res = await fetch("/api/user/invoices", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to save");
      return true;
    } catch (error) {
      console.error(error);
      alert("Failed to save invoice.");
      return false;
    }
  };

  const handleSendEmail = async () => {
    if (!invoiceRef.current) return;
    
    const defaultEmail = invoice.clientName 
      ? invoice.clientName.toLowerCase().replace(/\s/g, '') + "@gmail.com" 
      : "";
    const actualEmail = prompt(`Confirm recipient's email address:`, defaultEmail);
    if (!actualEmail) return;

    try {
      const { domToJpeg } = await import("modern-screenshot");
      const { jsPDF } = await import("jspdf");

      const element = invoiceRef.current;
      
      const originalShadow = element.style.boxShadow;
      const originalBorder = element.style.border;
      const originalRadius = element.style.borderRadius;
      
      element.style.boxShadow = 'none';
      element.style.border = 'none';
      element.style.borderRadius = '0';
      
      const dataUrl = await domToJpeg(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('print:hidden'))
      });

      element.style.boxShadow = originalShadow;
      element.style.border = originalBorder;
      element.style.borderRadius = originalRadius;

      const pdf = new jsPDF("p", "mm", "a4");
      
      const margin = 10;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const printWidth = pdfPageWidth - (margin * 2);
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const printHeight = (imgProps.height * printWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, "JPEG", margin, margin, printWidth, printHeight, undefined, 'FAST');
      const pdfBlob = pdf.output("blob");

      const formData = new FormData();
      formData.append("pdf", pdfBlob, `${invoice.invoiceNumber}.pdf`);
      formData.append("toEmail", actualEmail);
      formData.append("clientName", invoice.clientName || invoice.clientCompany || "Client");
      formData.append("invoiceNumber", invoice.invoiceNumber);
      
      const senderName = invoice.senderCompany || invoice.senderName || "Invoice Generator";
      formData.append("senderName", senderName);

      // @ts-ignore - Assuming invoice.id exists if loaded from DB
      if (invoice.id) formData.append("invoiceId", invoice.id); 

      const res = await fetch("/api/user/invoices/send", { method: "POST", body: formData });
      const result = await res.json();
      
      if (result.success) alert("Email sent successfully!");
      else alert("Failed to send email: " + result.message);

    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Error processing PDF for email.");
    }
  };

  const handleActionClick = async () => {
    setIsProcessing(true);
    if (isLoggedIn) {
      const saved = await handleSave();
      if (saved) await handleSendEmail();
    } else {
      await handleSendEmail();
    }
    setIsProcessing(false);
  };

  return (
    <div className="w-full py-10 px-6 bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-6xl justify-center flex flex-wrap lg:flex-nowrap gap-6">
        
        {/* LEFT - Invoice Section */}
        <div className="flex-2 w-full lg:max-w-3xl">
          <Card className="p-10 shadow-lg border bg-white rounded-xl">
            <CardContent className="space-y-8 p-0" ref={invoiceRef}>
              
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="space-y-1 text-sm text-gray-800 w-1/2">
                  <label className="cursor-pointer mb-4 w-32 h-20 border border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400">Upload Logo</span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>

                  <div className="font-medium">
                    <InlineInput name="senderCompany" placeholder="Your Company" value={invoice.senderCompany} onChange={handleChange} className="font-semibold text-base" />
                  </div>
                  <InlineInput name="senderName" placeholder="Your Name" value={invoice.senderName} onChange={handleChange} />
                  <InlineInput name="senderAddress" placeholder="Company's Address" value={invoice.senderAddress} onChange={handleChange} />
                  <InlineInput name="senderCityZip" placeholder="City, State Zip" value={invoice.senderCityZip} onChange={handleChange} />
                  <InlineInput name="senderCountry" placeholder="Country" value={invoice.senderCountry} onChange={handleChange} />
                </div>

                <div className="text-right w-1/2">
                  <InlineInput 
                    name="title" 
                    value={invoice.title} 
                    onChange={handleChange} 
                    className="text-4xl font-light tracking-wide text-right uppercase mb-4 text-gray-800" 
                    placeholder="INVOICE"
                  />
                </div>
              </div>

              {/* Billing */}
              <div className="flex justify-between text-sm mt-8">
                <div className="w-1/2 pr-4 space-y-1">
                  <p className="font-semibold text-gray-800 mb-1">Bill To:</p>
                  <InlineInput name="clientCompany" placeholder="Your Client's Company" value={invoice.clientCompany} onChange={handleChange} className="font-medium" />
                  <InlineInput name="clientName" placeholder="Client Name" value={invoice.clientName} onChange={handleChange} />
                  <InlineInput name="clientAddress" placeholder="Client's Address" value={invoice.clientAddress} onChange={handleChange} />
                  <InlineInput name="clientCityZip" placeholder="City, State Zip" value={invoice.clientCityZip} onChange={handleChange} />
                  <InlineInput name="clientCountry" placeholder="Country" value={invoice.clientCountry} onChange={handleChange} />
                </div>

                <div className="text-right space-y-2 w-[200px]">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-600">Invoice#</span>
                    <InlineInput name="invoiceNumber" value={invoice.invoiceNumber} onChange={handleChange} className="text-right w-24 font-medium" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-600">Date</span>
                    <InlineInput type="date" name="issueDate" value={invoice.issueDate} onChange={handleChange} className="text-right w-32" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-600">Due Date</span>
                    <InlineInput type="date" name="dueDate" value={invoice.dueDate} onChange={handleChange} className="text-right w-32" />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border rounded-md overflow-hidden mt-8">
                <div className={`grid grid-cols-12 ${currentColor.color} text-white text-sm font-medium p-2.5`}>
                  <div className="col-span-6 pl-1">Item Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right pr-1">Amount</div>
                </div>

                {invoice.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 text-sm p-2 border-t items-start group">
                    <div className="col-span-6 pr-2">
                      <InlineTextarea 
                        rows={1}
                        value={item.description} 
                        onChange={(e: any) => handleItemChange(i, "description", e.target.value)} 
                        placeholder="Enter item name/description" 
                        className="text-gray-700 min-h-[32px]"
                      />
                    </div>
                    <div className="col-span-2 px-1">
                      <InlineInput 
                        type="number" 
                        value={item.quantity || ""} 
                        onChange={(e: any) => handleItemChange(i, "quantity", Number(e.target.value))} 
                        className="text-center"
                      />
                    </div>
                    <div className="col-span-2 px-1">
                      <InlineInput 
                        type="number" 
                        value={item.rate || ""} 
                        onChange={(e: any) => handleItemChange(i, "rate", Number(e.target.value))} 
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-2 text-right py-1 flex justify-end items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {(item.quantity * item.rate).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => removeItem(i)} 
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity print:hidden w-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={addItem} 
                className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800 transition-colors print:hidden"
              >
                <Plus className="w-4 h-4" /> Add Line Item
              </button>

              {/* Totals & Extra Info Container */}
              <div className="flex justify-between items-end mt-8">
                
                {/* Notes & Terms */}
                <div className="w-[50%] space-y-6">
                  <div>
                    <InlineInput 
                      name="notesTitle" 
                      value={invoice.notesTitle} 
                      onChange={handleChange} 
                      className="font-medium text-gray-800 mb-1" 
                      placeholder="Notes"
                      emptyHidePrint
                    />
                    <InlineTextarea 
                      name="notes" 
                      value={invoice.notes} 
                      onChange={handleChange} 
                      className="text-sm text-gray-600 h-10" 
                      placeholder="Add any notes here..."
                      emptyHidePrint
                    />
                  </div>

                  <div>
                    <InlineInput 
                      name="termsTitle" 
                      value={invoice.termsTitle} 
                      onChange={handleChange} 
                      className="font-medium text-gray-800 mb-1" 
                      placeholder="Terms & Conditions"
                      emptyHidePrint
                    />
                    <InlineTextarea 
                      name="terms" 
                      value={invoice.terms} 
                      onChange={handleChange} 
                      className="text-sm text-gray-600 h-10" 
                      placeholder="Add terms and conditions..."
                      emptyHidePrint
                    />
                  </div>

                  {/* QR Code display on Invoice */}
                  {invoice.includeQrCode && invoice.paymentUpiId && (
                     <div className="mt-4 flex items-center gap-4 p-3 border rounded-lg bg-gray-50/50 w-max">
                        <div className="bg-white p-1.5 rounded border shadow-sm">
                           <QRCodeSVG value={`upi://pay?pa=${invoice.paymentUpiId}&pn=${encodeURIComponent(invoice.senderCompany || invoice.senderName)}&am=${total.toFixed(2)}&cu=INR`} size={64} level="H" />
                        </div>
                        <div className="text-sm">
                           <p className="font-bold text-gray-800">Scan to Pay</p>
                           <p className="text-gray-500 font-mono text-xs mt-0.5">{invoice.paymentUpiId}</p>
                        </div>
                     </div>
                  )}
                </div>

                {/* Calculation Totals */}
                <div className="w-64 space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Sub Total</span>
                    <span className="font-medium text-gray-800">{subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center">
                      Tax (
                      <InlineInput 
                        type="number" 
                        value={invoice.taxRate} 
                        onChange={(e: any) => setInvoice(p => ({...p, taxRate: Number(e.target.value)}))} 
                        className="w-8 text-center border-b border-dashed border-gray-300 mx-1 font-medium text-gray-800"
                      />
                      %)
                    </span>
                    <span className="font-medium text-gray-800">{taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-3 text-gray-900">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT - Sticky Panel */}
        <div className="relative w-full lg:w-80">
          <div className="sticky top-10">
            <Card className="p-6 border shadow-sm bg-white rounded-xl">
              <CardContent className="p-0 space-y-6">
                
                {/* Header */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invoice Settings
                  </h3>
                  <div className="h-px bg-gray-100 mt-4" />
                </div>

                {/* Theme */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Theme Color</p>
                  <div className="flex items-center gap-3">
                    {themes.map((t) => (
                      <div key={t.name} onClick={() => setCurrentColor(t)} className="relative">
                        <div className={cn("w-6 h-6 rounded-full cursor-pointer shadow-sm hover:scale-110 transition-transform", t.color)} />
                        {t.name === currentColor.name && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-gray-100 pt-2" />
                </div>

                {/* Templates */}
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <div key={t.name} className="text-center space-y-2">
                      <div
                        className={cn(
                          "rounded-lg border p-2 h-24 flex items-center justify-center bg-gray-50 cursor-pointer transition-all",
                          t.active ? "border-blue-500 ring-1 ring-blue-500 shadow-sm" : "border-gray-200 hover:border-blue-300"
                        )}
                      >
                        <div className="w-full h-full flex flex-col gap-1.5 opacity-70">
                          <div className="h-1.5 bg-gray-300 w-1/3 rounded-full" />
                          <div className="h-1.5 bg-gray-300 w-1/4 rounded-full" />
                          <div className="flex-1 border border-gray-200 rounded bg-white mt-1" />
                        </div>
                      </div>
                      <p className={cn("text-xs font-medium", t.active ? "text-blue-600" : "text-gray-600")}>
                        {t.name}
                        {t.name.includes("more") && <ExternalLink className="inline w-3 h-3 ml-1" />}
                      </p>
                    </div>
                  ))}
                </div>

                {/* UPI / QR Code Section */}
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-gray-700">Payment Options</p>
                  {isLoggedIn && hasSavedUpi ? (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={invoice.includeQrCode} 
                        onChange={e => setInvoice(p => ({...p, includeQrCode: e.target.checked}))} 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Include UPI QR Code
                    </label>
                  ) : (
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <label className="text-xs font-medium text-gray-600 block">UPI ID for Payment QR</label>
                      <input
                         type="text"
                         placeholder="e.g. yourname@upi"
                         className="w-full text-sm border-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                         value={invoice.paymentUpiId}
                         onChange={e => setInvoice(p => ({
                            ...p, 
                            paymentUpiId: e.target.value, 
                            includeQrCode: !!e.target.value // Auto enable if they type
                         }))}
                      />
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100" />

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleActionClick} 
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
                  >
                    {isProcessing 
                      ? "Processing..." 
                      : (isLoggedIn ? "Save and Send" : "Send Email")}
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => handleDownloadPDF()}
                    className="w-full border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}