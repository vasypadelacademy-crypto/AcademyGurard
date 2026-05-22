import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Clock, Send, X, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useData } from '../lib/DataContext';
import { toTitleCase } from '../lib/utils';
import { Player, Package, Session } from '../types';
import { generateEmailBody, generateEmailHtml } from '../lib/emailUtils';

interface EmailScheduleModalProps {
  player: Player;
  activePackage: Package | undefined;
  currentPackageSessions: Session[];
  derivedTotalDue?: number;
  realPaidAmount?: number;
  activePkgLabel?: string;
  payments?: any[];
  sessionIndexMap?: Map<string, string>;
  oldDue?: number;
  onClose: () => void;
}

export function EmailScheduleModal({ 
  player, 
  activePackage, 
  currentPackageSessions, 
  derivedTotalDue, 
  realPaidAmount, 
  activePkgLabel, 
  payments, 
  sessionIndexMap,
  oldDue,
  onClose 
}: EmailScheduleModalProps) {
  const { locations, groups } = useData();

  const [to, setTo] = useState(player.email || (player as any).emergencyContact || '');
  const [subject, setSubject] = useState(`Vas-y Padel Academy - Schedule Report for C. ${toTitleCase(player.name || '')}`);
  const [body, setBody] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  useEffect(() => {
    setBody(generateEmailBody(player, activePackage, currentPackageSessions, locations, undefined, derivedTotalDue, realPaidAmount, activePkgLabel, payments, sessionIndexMap, undefined, oldDue, groups));
  }, [player, activePackage, currentPackageSessions, locations, derivedTotalDue, realPaidAmount, activePkgLabel, payments, sessionIndexMap, oldDue, groups]);

  const handleSend = async () => {
    if (!to) {
      setStatusMsg({ type: 'error', text: 'Please specify a recipient email address.' });
      return;
    }
    
    setIsSending(true);
    setStatusMsg(null);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           to: to,
           subject: subject,
           body: body,
           html: generateEmailHtml(player, activePackage, currentPackageSessions, locations, undefined, derivedTotalDue, realPaidAmount, activePkgLabel, payments, sessionIndexMap, undefined, oldDue, groups)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to send email');
      }
      
      setStatusMsg({ type: 'success', text: 'Email sent successfully with schedule attached!' });
      
      // Auto close after 2s
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error("Error in handleSend:", err);
      setStatusMsg({ 
        type: 'error', 
        text: 'Error sending email: ' + err.message + '\n\nMake sure to set GMAIL_USER and GMAIL_APP_PASSWORD.' 
      });
    } finally {
      setIsSending(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-bento overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
            <Mail className="text-blue-500" size={24} /> 
            Email Schedule
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 transition-colors rounded-full hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 pb-4 space-y-4">
          
          {statusMsg && (
            <div className={`p-4 rounded-xl border-2 text-sm font-bold shadow-sm ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {statusMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">From</label>
              <div className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-3 text-slate-400 font-mono text-sm opacity-70">
                vasy.padelacademy@gmail.com
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">To</label>
              <input 
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="player@example.com"
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 font-medium"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">Subject</label>
              <input 
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">Message & Attachment Content</label>
            <textarea 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-4 text-slate-300 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors min-h-[300px] leading-relaxed resize-y"
            />
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-300 font-bold">
            <FileText size={16} className="text-blue-500" />
            <span>The content above will be sent in the email body.</span>
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-800/50 mt-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl transition-all uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={isSending}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-bento uppercase tracking-widest text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Clock className="animate-spin" size={16} /> 
                Sending...
              </>
            ) : (
              <>
                <Send size={16} /> 
                Send Email
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
