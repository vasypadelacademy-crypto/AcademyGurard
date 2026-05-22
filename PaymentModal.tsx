import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useData } from '../lib/DataContext';
import { formatCurrency, toTitleCase } from '../lib/utils';
import { Combobox } from './Combobox';
import { manageFinancialAlarm } from '../lib/financialManager';

import { findBestPricingScheme, calculatePackageValues } from '../lib/pricingUtils';
import { generatePaymentConfirmationEmailHtml, generatePaymentConfirmationEmailBody } from '../lib/emailUtils';

interface PaymentModalProps {
  pkg: any;
  onClose: () => void;
  initialAmount?: number;
}

export function PaymentModal({ pkg, onClose, initialAmount }: PaymentModalProps) {
  const { addMasterData, updateMasterData, sessions, pricingSchemes, reminders, deleteMasterData, players, packages, payments } = useData();
  const player = players.find(p => p.id === pkg.playerId);
  
  const currentPayments = (payments || []).filter((p: any) => String(p.packageId) === String(pkg.id));
  const realPaidAmount = currentPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const paidToUse = realPaidAmount > 0 ? realPaidAmount : (pkg.paidAmount || 0);
  
  const pkgSessions = (sessions || []).filter((s: any) => String(s.packageId) === String(pkg.id));
  const { derivedBaseAmount: derivedBase, derivedTotalDue: derivedTotal } = calculatePackageValues(pkg, pkgSessions, pricingSchemes, pkg?.forceSystemPricing || false);
  
  const actualDerivedTotal = initialAmount !== undefined ? paidToUse + initialAmount : derivedTotal;
  const remainingAmount = initialAmount !== undefined ? initialAmount : (actualDerivedTotal - paidToUse);

  const [formData, setFormData] = useState({
    amount: Math.max(0, remainingAmount).toString(),
    date: new Date().toISOString().slice(0, 10),
    method: 'Bank' as 'Bank' | 'Cash',
    note: ''
  });
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (amountInputRef.current) {
        amountInputRef.current.select();
    }
  }, []);

  const handleRecord = async () => {
    const amountNum = Number(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) return alert("Invalid amount");

    await addMasterData('payments', {
      packageId: pkg.id,
      playerId: pkg.playerId,
      amount: amountNum,
      date: formData.date,
      method: formData.method,
      note: formData.note,
      timestamp: Date.now()
    });

    const newPaid = paidToUse + amountNum;
    let newStatus = 'Not Paid';
    if (newPaid >= (derivedTotal - 0.01)) newStatus = 'Paid';
    else if (newPaid > 0) newStatus = 'Partially Paid';

    await updateMasterData('packages', pkg.id, {
      paidAmount: newPaid,
      status: newStatus,
      totalDue: derivedTotal,
      baseAmount: derivedBase
    });

    // Ask to send payment confirmation email
    const recipientEmail = player?.email || player?.parentEmail;
    if (recipientEmail && window.confirm(`Send payment notification email to ${player?.name}?`)) {
      try {
        const sortedPlayerPackages = [...(packages || [])]
          .filter(p => p.playerId === pkg.playerId)
          .sort((a, b) => {
            const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
            if (dateCompare !== 0) return dateCompare;
            return (a.id || '').localeCompare(b.id || '');
          });
        const packageIndex = sortedPlayerPackages.findIndex(p => p.id === pkg.id);
        const pkgLabel = packageIndex >= 0 ? 'M' + (packageIndex + 1) : (pkg.packageTypeCode || 'Package');

        const html = generatePaymentConfirmationEmailHtml(
          player,
          pkgLabel,
          formData.date,
          amountNum,
          formData.method
        );
        const body = generatePaymentConfirmationEmailBody(
          player,
          pkgLabel,
          formData.date,
          amountNum,
          formData.method
        );

        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientEmail,
            subject: `Payment confirmation Pkg ID ${pkgLabel} - C. ${toTitleCase(player?.name || '')}`,
            body: body,
            html: html
          })
        });
      } catch (err) {
        console.error("Failed to send payment confirmation email:", err);
      }
    }

    // Automatically manage financial alarms
    await manageFinancialAlarm(
      pkg.playerId, 
      player?.name || 'Player',
      packages,
      sessions,
      reminders,
      addMasterData, 
      updateMasterData, 
      deleteMasterData,
      payments,
      pricingSchemes,
      derivedTotal - newPaid
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-2xl overflow-hidden">
        <h2 className="text-xl font-black text-white italic mb-8 uppercase tracking-tight">Record Remittance</h2>
        
        <div className="mb-8 space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-500">Total package due</span>
            <span className="text-emerald-500">{formatCurrency(derivedTotal)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-500">Remaining Liability</span>
            <span className="text-red-500">{formatCurrency(Math.max(0, derivedTotal - paidToUse))}</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-base text-emerald-400">Amount</label>
              <input 
                autoFocus
                ref={amountInputRef}
                type="number"
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 font-black text-2xl border-emerald-500/20 focus:border-emerald-500 text-white italic focus:outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-800"
              />
            </div>
            <div>
              <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Method</label>
              <Combobox
                value={formData.method}
                onChange={val => setFormData({...formData, method: val as 'Bank' | 'Cash'})}
                options={['Bank', 'Cash']}
                getLabel={(v) => v === 'Bank' ? 'Bank Transfer' : 'Cash Payment'}
                className="font-black text-xs uppercase italic !bg-slate-950 border-slate-700 h-11"
                fullWidth
              />
            </div>
            <div>
              <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Transaction Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 font-black text-slate-300 italic text-xs h-11 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Internal Note</label>
            <input 
              type="text" 
              placeholder="e.g. Received via CIB"
              value={formData.note}
              onChange={e => setFormData({...formData, note: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 font-black text-slate-300 italic text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-10">
           <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition italic">Cancel</button>
           <button 
             onClick={handleRecord}
             className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all italic active:scale-95"
           >
             Post Payment
           </button>
        </div>
      </motion.div>
    </div>
  );
}

export function EditPaymentModal({ payment, pkg, onClose }: { payment: any, pkg: any, onClose: () => void }) {
  const { updateMasterData, payments, reminders, deleteMasterData, players, addMasterData, packages, sessions, pricingSchemes } = useData();
  const player = players.find(p => p.id === pkg.playerId);
  const [formData, setFormData] = useState({
    amount: payment.amount.toString(),
    date: payment.date,
    method: payment.method || 'Bank' as 'Bank' | 'Cash',
    note: payment.note || ''
  });
  const amountInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = async () => {
    const amountNum = Number(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) return alert("Invalid amount");

    // Calculate new total paid for the package
    const otherPayments = (payments || []).filter((p: any) => p.packageId === pkg.id && p.id !== payment.id);
    const newPaid = otherPayments.reduce((acc: number, p: any) => acc + p.amount, 0) + amountNum;
    
    let newStatus = 'Not Paid';
    if (newPaid >= pkg.totalDue) newStatus = 'Paid';
    else if (newPaid > 0) newStatus = 'Partially Paid';

    await updateMasterData('payments', payment.id, {
      amount: amountNum,
      date: formData.date,
      method: formData.method,
      note: formData.note
    });

    await updateMasterData('packages', pkg.id, {
      paidAmount: newPaid,
      status: newStatus
    });
    
    // Automatically manage financial alarms
    const remainingAmount = (pkg.totalDue || 0) - (pkg.paidAmount || 0);
    await manageFinancialAlarm(
      pkg.playerId,                
      player?.name || 'Player',
      packages,
      sessions,
      reminders,
      addMasterData,                
      updateMasterData,                
      deleteMasterData,
      payments,
      pricingSchemes,
      remainingAmount
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-2xl overflow-hidden">
        <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-tight text-blue-400">Edit Payment Entry</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-base text-emerald-400">Amount</label>
              <input 
                ref={amountInputRef}
                autoFocus
                type="number" 
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 font-black text-3xl border-emerald-500/20 focus:border-emerald-500 text-white italic focus:outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-800"
              />
            </div>
            <div>
              <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Method</label>
              <select
                value={formData.method}
                onChange={e => setFormData({...formData, method: e.target.value as any})}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 font-black text-slate-300 italic text-xs h-11 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="Bank">Bank Transfer</option>
                <option value="Cash">Cash Payment</option>
              </select>
            </div>
            <div>
              <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Transaction Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 font-black text-slate-300 italic text-xs h-11 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="label-base text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Internal Note</label>
            <input 
              type="text" 
              placeholder="e.g. Received via CIB"
              value={formData.note}
              onChange={e => setFormData({...formData, note: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 font-black text-slate-300 italic text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-10">
           <button onClick={onClose} className="flex-1 px-5 py-3 text-sm font-black text-slate-500 uppercase tracking-widest hover:text-white transition italic">Cancel</button>
           <button 
             onClick={handleUpdate}
             className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-[0.2em] shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all italic active:scale-95"
           >
             Update Entry
           </button>
        </div>
      </motion.div>
    </div>
  );
}
