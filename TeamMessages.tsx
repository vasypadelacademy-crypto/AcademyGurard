import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Mail, 
  Send,
  Image as ImageIcon, 
  Check, 
  CheckCircle2, 
  Users, 
  Search, 
  AlertCircle,
  FileText,
  Clock,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TeamMessage, Player, Group } from '../types';

export default function TeamMessages() {
  const { 
    players, 
    groups, 
    teamMessages, 
    addMasterData, 
    updateMasterData, 
    deleteMasterData, 
    currentUserRole,
    dbError 
  } = useData();

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const pId = searchParams.get('playerId');
    const gId = searchParams.get('groupId');
    if (pId) {
      setSelectedMessage(null);
      setSubject('');
      setBody('');
      setRecipientType('specific_active_players');
      setSelectedGroupIds([]);
      setSelectedPlayerIds([pId]);
      setImageBase64('');
      setImageName('');
      setErrorMsg('');
      setSuccessMsg('');
      setShowFormModal(true);
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('playerId');
      setSearchParams(newParams);
    } else if (gId) {
      setSelectedMessage(null);
      setSubject('');
      setBody('');
      setRecipientType('all_active_groups');
      setSelectedGroupIds([gId]);
      setSelectedPlayerIds([]);
      setImageBase64('');
      setImageName('');
      setErrorMsg('');
      setSuccessMsg('');
      setShowFormModal(true);
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('groupId');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TeamMessage | null>(null);

  // Read-only user prevention
  const isReadOnly = currentUserRole?.role === 'visitor';

  // Delete confirmation modals state hooks
  const [msgToDelete, setMsgToDelete] = useState<TeamMessage | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  
  // Form values
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientType, setRecipientType] = useState<'all_active_groups' | 'specific_active_players'>('all_active_groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  
  // Inline filters for player list inside Form
  const [formPlayerSearch, setFormPlayerSearch] = useState('');
  const [formGroupSearch, setFormGroupSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filter lists
  const activeGroups = useMemo(() => {
    return groups.filter(g => g.isActive !== false);
  }, [groups]);

  const activePlayers = useMemo(() => {
    return players.filter(p => p.isActive !== false);
  }, [players]);

  const filteredTeamMessages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return teamMessages;
    return teamMessages.filter(m => 
      m.subject.toLowerCase().includes(q) || 
      m.body.toLowerCase().includes(q)
    );
  }, [teamMessages, searchQuery]);

  // Handle Form open for Create
  const handleOpenCreateMsg = () => {
    setSelectedMessage(null);
    setSubject('');
    setBody('');
    setRecipientType('all_active_groups');
    setSelectedGroupIds([]);
    setSelectedPlayerIds([]);
    setImageBase64('');
    setImageName('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  // Handle Form open for Edit
  const handleOpenEditMsg = (msg: TeamMessage) => {
    setSelectedMessage(msg);
    setSubject(msg.subject);
    setBody(msg.body);
    setRecipientType(msg.recipientType);
    setSelectedGroupIds(msg.recipientGroupIds || []);
    setSelectedPlayerIds(msg.recipientPlayerIds || []);
    setImageBase64(msg.imageUrl || '');
    setImageName(msg.imageUrl ? 'Uploaded Image' : '');
    setErrorMsg('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  // Process selected emails and run send API
  const handleSendEmails = async (messageObject: any) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Fetch targets and resolve unique emails
    let targetPlayers: Player[] = [];
    if (messageObject.recipientType === 'all_active_groups') {
      const groupIds = messageObject.recipientGroupIds || [];
      targetPlayers = activePlayers.filter(p => {
        if (p.groupAssignments && p.groupAssignments.length > 0) {
          return p.groupAssignments.some(ga => groupIds.includes(ga.groupId) && ga.isActive);
        }
        return p.groupId && groupIds.includes(p.groupId);
      });
    } else {
      const playerIds = messageObject.recipientPlayerIds || [];
      targetPlayers = activePlayers.filter(p => p.id && playerIds.includes(p.id));
    }

    if (targetPlayers.length === 0) {
      setErrorMsg('No active players with contact emails matched selection.');
      setLoading(false);
      return;
    }

    const recipientEmails = Array.from(new Set(
      targetPlayers.flatMap(p => {
        const mails: string[] = [];
        if (p.email && p.email.trim()) mails.push(p.email.trim());
        if (p.hasParent && p.parentEmail && p.parentEmail.trim()) mails.push(p.parentEmail.trim());
        return mails;
      })
    ));

    if (recipientEmails.length === 0) {
      setErrorMsg('None of the resolved player(s) or parents had valid email contacts provided.');
      setLoading(false);
      return;
    }

    try {
      // Build a premium HTML notification envelope with embedded VP logo in place of red circle
      const htmlBody = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Header banner with inline logo -->
            <div style="background-color: #0f172a; padding: 24px; border-bottom: 2px solid #3b82f6; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0; text-align: left;">
                <tr>
                  <td style="padding-right: 16px; vertical-align: middle;">
                    <!-- VP Logo -->
                    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; color: #ffffff;">
                      <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="5" fill="#000000" />
                      <path d="M 28 32 L 42 66" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
                      <path d="M 44 75 L 62 26" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
                      <path d="M 55 42 L 67 42 C 74 42 78 46 78 52 C 78 58 74 62 66 62 L 50 62" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M 61 34 L 72 34 L 66.5 24 Z" fill="currentColor" />
                    </svg>
                  </td>
                  <td style="vertical-align: middle;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; font-style: italic; line-height: 1.1;">
                      Vas-y Padel Academy
                    </h1>
                    <p style="color: #94a3b8; font-size: 11px; font-weight: 700; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; line-height: 1;">
                      Broadcast Announcement
                    </p>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Context body -->
            <div style="padding: 32px;">
              <h2 style="color: #0f172a; font-size: 14px; font-weight: bold; line-height: 1.4; margin: 0 0 16px 0;">
                ${messageObject.subject}
              </h2>
              
              <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line; margin-bottom: 24px;">${messageObject.body}</div>
              
              <div style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Best,<br />
                <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 4px;">
                  <tr>
                    <td style="vertical-align: middle;">
                      <strong style="color: #0f172a;">Vas-y Padel Academy</strong>
                    </td>
                    <td style="padding-left: 6px; vertical-align: middle;">
                      <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; color: #3b82f6;">
                        <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="5" fill="#000000" />
                        <path d="M 28 32 L 42 66" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
                        <path d="M 44 75 L 62 26" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
                        <path d="M 55 42 L 67 42 C 74 42 78 46 78 52 C 78 58 74 62 66 62 L 50 62" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M 61 34 L 72 34 L 66.5 24 Z" fill="currentColor" />
                      </svg>
                    </td>
                  </tr>
                </table>
              </div>
              
              ${messageObject.imageUrl ? `
                <div style="margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                  <img src="cid:news_image" alt="" style="width: 100%; display: block;" referrerPolicy="no-referrer" />
                </div>
              ` : ''}
            </div>

            <!-- Footer block -->
            <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Vas-y Padel Team</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8;">This is a system-generated circular broadcast.</p>
            </div>
          </div>
        </div>
      `;

      // Trigger standard proxy API route
      const cleanBase64 = messageObject.imageUrl ? messageObject.imageUrl.split('base64,')[1] : null;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmails.join(','),
          subject: `📢 Academy Broadcast: ${messageObject.subject}`,
          body: `${messageObject.body}\n\nSent via Vas-y Padel Academy Manager.`,
          html: htmlBody,
          attachmentData: cleanBase64,
          attachmentName: 'announcement_image.png',
          isImage: !!messageObject.imageUrl,
          contentType: 'image/png',
          isTeamMessage: true
        })
      });

      const responseJson = await response.json();
      if (!response.ok) {
        throw new Error(responseJson.error || 'Server rejected email delivery request.');
      }

      setSuccessMsg(`Email successfully broadcast to ${recipientEmails.length} recipient address(es)!`);
      
      // Close the compose email menu after 4 seconds when sent successfully
      setTimeout(() => {
        setShowFormModal(false);
      }, 4000);
    } catch (e: any) {
      setErrorMsg(`SMTP Mail Warning: Saved offline profile correctly, but email dispatch failed. Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // File to base64 reader handler
  const handleImageUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Image size too large. Please select a file under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
        setImageName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Group selectors
  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds(curr => 
      curr.includes(id) ? curr.filter(gId => gId !== id) : [...curr, id]
    );
  };

  const selectAllGroups = () => {
    setSelectedGroupIds(activeGroups.map(g => g.id || ''));
  };

  const selectNoGroups = () => {
    setSelectedGroupIds([]);
  };

  // Player selectors
  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds(curr => 
      curr.includes(id) ? curr.filter(pId => pId !== id) : [...curr, id]
    );
  };

  const selectAllPlayers = () => {
    setSelectedPlayerIds(activePlayers.map(p => p.id || ''));
  };

  const selectNoPlayers = () => {
    setSelectedPlayerIds([]);
  };

  // Submit form payload for Firestore save, and then send
  const handleSubmit = async (shouldEmail: boolean) => {
    if (!subject.trim()) {
      setErrorMsg('Message Subject is required.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Message Body is required.');
      return;
    }
    if (recipientType === 'all_active_groups' && selectedGroupIds.length === 0) {
      setErrorMsg('At least one recipient group must be specified.');
      return;
    }
    if (recipientType === 'specific_active_players' && selectedPlayerIds.length === 0) {
      setErrorMsg('At least one player recipient must be specified.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload: Omit<TeamMessage, 'id'> = {
      subject: subject.trim(),
      body: body.trim(),
      imageUrl: imageBase64,
      recipientType,
      recipientGroupIds: recipientType === 'all_active_groups' ? selectedGroupIds : [],
      recipientPlayerIds: recipientType === 'specific_active_players' ? selectedPlayerIds : [],
      createdAt: new Date().toISOString()
    };

    try {
      if (selectedMessage && selectedMessage.id) {
        // Edit update DB record
        await updateMasterData('teamMessages', selectedMessage.id, payload);
        
        if (shouldEmail) {
          await handleSendEmails({ id: selectedMessage.id, ...payload });
        } else {
          setSuccessMsg('Team message updated successfully!');
          setTimeout(() => setShowFormModal(false), 1500);
        }
      } else {
        // New save DB record
        const savedRef: any = await addMasterData('teamMessages', payload);
        const savedId = savedRef?.id;
        
        if (shouldEmail) {
          await handleSendEmails({ id: savedId, ...payload });
        } else {
          setSuccessMsg('Team message draft saved successfully!');
          setTimeout(() => setShowFormModal(false), 1500);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Database transaction error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Handle message delete
  const handleDelete = async (id: string) => {
    try {
      await deleteMasterData('teamMessages', id);
      setMsgToDelete(null);
    } catch (err: any) {
      alert('Failed to delete message: ' + err.message);
    }
  };

  // Handle delete all messages
  const handleDeleteAll = async () => {
    try {
      setLoading(true);
      const deletePromises = teamMessages.map(async m => {
        if (m.id) {
          await deleteMasterData('teamMessages', m.id);
        }
      });
      await Promise.all(deletePromises);
      setShowDeleteAllConfirm(false);
    } catch (err: any) {
      alert('Failed to delete all messages: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs md:text-sm text-blue-500 uppercase tracking-[0.2em] mb-2">Communications Office</p>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">Team Messages</h1>
          <p className="text-slate-400 mt-2 uppercase text-[10px] md:text-xs tracking-widest leading-none">
            Compose circulars and broadcast priority messages down to teams or specific active rosters
          </p>
        </div>
        
        <button
          onClick={handleOpenCreateMsg}
          className="flex items-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-bento self-start md:self-auto"
        >
          <Plus size={14} />
          <span>New Team Message</span>
        </button>
      </div>

      {dbError && (
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-widest animate-pulse max-w-3xl">
          <AlertCircle size={18} />
          <span>{dbError}</span>
        </div>
      )}

      {/* Message Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 border-2 border-slate-800 p-4 rounded-3xl shadow-bento-subtle">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="FILTER TEAM ARCHIVES..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl pl-12 pr-4 h-12 text-xs font-bold uppercase tracking-widest text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black italic">
            Total communications: {filteredTeamMessages.length} broadcast logs
          </div>
          {teamMessages.length > 0 && !isReadOnly && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title="Delete All Messages"
            >
              <Trash2 size={10} />
              <span>Clear All Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Main message archival registry list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeamMessages.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900 bg-opacity-40 border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center p-8">
            <Mail size={48} className="text-slate-700 mb-4 animate-pulse" />
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No Broadcasts Registered</h3>
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1 max-w-sm text-center leading-relaxed">
              Activate communications by composed messages to all locations or custom target filters now.
            </p>
          </div>
        ) : (
          filteredTeamMessages.map(msg => (
            <div 
              key={msg.id}
              className="bg-slate-900 border-2 border-slate-800 hover:border-slate-700/50 rounded-[2rem] p-6 shadow-bento flex flex-col relative overflow-hidden group transition-all"
            >
              {/* Image banner preview within card */}
              {msg.imageUrl && (
                <div className="h-36 w-full -mx-6 -mt-6 mb-4 overflow-hidden border-b-2 border-slate-800 bg-slate-950">
                  <img 
                    src={msg.imageUrl} 
                    alt="attachment" 
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Card Meta details */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">
                  {msg.recipientType === 'all_active_groups' ? 'Group Broadcast' : 'Specific Contacts'}
                </span>
                <div className="text-[9px] text-slate-500 font-bold tracking-widest flex items-center gap-1">
                  <Clock size={10} />
                  <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}</span>
                </div>
              </div>

              {/* Title and core teaser */}
              <h3 className="text-base font-black text-white italic leading-snug tracking-tight mb-2 line-clamp-1">
                {msg.subject}
              </h3>
              
              <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-6 leading-relaxed line-clamp-3">
                {msg.body}
              </p>

              {/* Distribution target counters */}
              <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  {msg.recipientType === 'all_active_groups' ? (
                    <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                      Targeting: <strong className="text-white">{(msg.recipientGroupIds || []).length} Active Groups</strong>
                    </p>
                  ) : (
                    <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                      Targeting: <strong className="text-white">{(msg.recipientPlayerIds || []).length} Active Roster Players</strong>
                    </p>
                  )}
                </div>

                {/* Operations */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditMsg(msg)}
                    className="p-2 border-2 border-slate-800 hover:border-blue-500/20 bg-slate-950 rounded-xl text-slate-400 hover:text-blue-500 transition-all"
                    title="Edit Circular"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setMsgToDelete(msg)}
                    className="p-2 border-2 border-slate-800 hover:border-red-500/20 bg-slate-950 rounded-xl text-slate-400 hover:text-red-500 transition-all"
                    title="Delete Record"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Premium Composer / Form Modal */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !loading && setShowFormModal(false)}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              />

              {/* Card Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-4xl rounded-[2.5rem] border-2 border-slate-800 bg-slate-900 p-6 md:p-8 text-left shadow-2xl overflow-hidden z-20"
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowFormModal(false)}
                  disabled={loading}
                  className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition"
                >
                  <X size={20} />
                </button>

                {/* Form Title banner */}
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic text-white leading-none">
                      {selectedMessage ? 'Edit Circular' : 'New Broadcast Circular'}
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                      Compose announcements and optional media assets to active teams
                    </p>
                  </div>
                </div>

                {errorMsg && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <CheckCircle2 size={16} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Form Grid Structure */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  
                  {/* Left Column Fields: Form parameters (Grid-span-3) */}
                  <div className="lg:col-span-3 space-y-6">
                    
                    {/* Subject */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-orange-400 uppercase">
                        Announcement Subject
                      </label>
                      <input
                        type="text"
                        placeholder="ENTER MESSAGE SUBJECT..."
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        disabled={loading}
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl h-12 px-4 shadow-inner text-xs font-bold tracking-widest text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {/* Body */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-orange-400 uppercase">
                        Message Content (Body)
                      </label>
                      <textarea
                        placeholder="WRITE COMPREHENSIVE COMMUNICATIONS BODY HERE..."
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        disabled={loading}
                        rows={6}
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 shadow-inner text-xs font-bold tracking-widest leading-relaxed text-white focus:outline-none focus:border-blue-500 transition-colors resize-y"
                      />
                    </div>

                    {/* Image Attachment widget */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-orange-400 uppercase flex items-center justify-between">
                        <span>Attach Circular Media</span>
                        <span className="text-[8px] text-slate-500 lowercase">(Square or wide png/jpg, limit 2MB)</span>
                      </label>
                      
                      {imageBase64 ? (
                        <div className="relative border-2 border-slate-800 bg-slate-950 rounded-2xl overflow-hidden p-2 flex items-center gap-4">
                          <img 
                            src={imageBase64} 
                            alt="preview" 
                            className="w-16 h-16 object-cover rounded-xl border border-slate-800" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] font-black text-white truncate uppercase tracking-widest">{imageName}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Selected Image Asset Ready</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setImageBase64('');
                              setImageName('');
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all mr-2"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-800 bg-slate-950 hover:bg-slate-950/75 rounded-2xl p-6 text-center cursor-pointer relative group transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUploadChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <ImageIcon className="mx-auto text-slate-600 group-hover:text-slate-400 mb-2 transition-colors" size={24} />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DRAG IMAGES OR CLICK TO UPLOAD</p>
                          <p className="text-[8px] font-semibold text-slate-600 uppercase tracking-widest mt-1">PNG, JPG, JPEG compatible</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column Fields: Target Selection & Distribution (Grid-span-2) */}
                  <div className="lg:col-span-2 flex flex-col space-y-6">
                    
                    {/* Recipient Selector switcher tab */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-orange-400 uppercase">
                        Distribution Scope
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border-2 border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientType('all_active_groups');
                            setErrorMsg('');
                          }}
                          className={cn(
                            "py-2 px-1 text-[9px] uppercase font-black tracking-wider rounded-xl transition",
                            recipientType === 'all_active_groups'
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          Active Groups
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientType('specific_active_players');
                            setErrorMsg('');
                          }}
                          className={cn(
                            "py-2 px-1 text-[9px] uppercase font-black tracking-wider rounded-xl transition",
                            recipientType === 'specific_active_players'
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          Active Players
                        </button>
                      </div>
                    </div>

                    {/* Dual Selector Panel matching selection */}
                    <div className="flex-1 flex flex-col bg-slate-950 border-2 border-slate-800 rounded-3xl p-4 min-h-[220px] max-h-[350px]">
                      
                      {recipientType === 'all_active_groups' ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Select Active Groups
                            </span>
                            <div className="flex gap-2">
                              <button 
                                type="button" 
                                onClick={selectAllGroups}
                                className="text-[8px] font-black text-blue-500 uppercase hover:underline tracking-wider"
                              >
                                ALL
                              </button>
                              <button 
                                type="button" 
                                onClick={selectNoGroups}
                                className="text-[8px] font-black text-slate-500 uppercase hover:underline tracking-wider"
                              >
                                NONE
                              </button>
                            </div>
                          </div>

                          <div className="relative mb-2 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                            <input
                              type="text"
                              placeholder="SEARCH GROUPS..."
                              value={formGroupSearch}
                              onChange={e => setFormGroupSearch(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-[10px] font-bold text-white uppercase focus:outline-none focus:border-slate-700"
                            />
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {activeGroups
                              .filter(g => !formGroupSearch || g.name.toLowerCase().includes(formGroupSearch.toLowerCase()) || g.code.toLowerCase().includes(formGroupSearch.toLowerCase()))
                              .map(g => {
                                const selected = selectedGroupIds.includes(g.id || '');
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleGroupSelection(g.id || '')}
                                    className={cn(
                                      "w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left",
                                      selected 
                                        ? "bg-blue-500/10 border-blue-500/20 text-white"
                                        : "bg-slate-900 border-transparent text-slate-400 hover:bg-slate-900/60"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full" 
                                        style={{ backgroundColor: g.color || '#3b82f6' }}
                                      />
                                      <span className="text-[10px] font-black uppercase tracking-widest">{g.code} - {g.name}</span>
                                    </div>
                                    {selected && <Check size={12} className="text-blue-500" />}
                                  </button>
                                );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Select Active Players
                            </span>
                            <div className="flex gap-2">
                              <button 
                                type="button" 
                                onClick={selectAllPlayers}
                                className="text-[8px] font-black text-blue-500 uppercase hover:underline tracking-wider"
                              >
                                ALL
                              </button>
                              <button 
                                type="button" 
                                onClick={selectNoPlayers}
                                className="text-[8px] font-black text-slate-500 uppercase hover:underline tracking-wider"
                              >
                                NONE
                              </button>
                            </div>
                          </div>

                          <div className="relative mb-2 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                            <input
                              type="text"
                              placeholder="SEARCH ACTIVE ROSTERS..."
                              value={formPlayerSearch}
                              onChange={e => setFormPlayerSearch(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-[10px] font-bold text-white uppercase focus:outline-none focus:border-slate-700"
                            />
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {activePlayers
                              .filter(p => !formPlayerSearch || p.name.toLowerCase().includes(formPlayerSearch.toLowerCase()) || (p.email && p.email.toLowerCase().includes(formPlayerSearch.toLowerCase())))
                              .map(p => {
                                const selected = selectedPlayerIds.includes(p.id || '');
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => togglePlayerSelection(p.id || '')}
                                    className={cn(
                                      "w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left",
                                      selected 
                                        ? "bg-blue-500/10 border-blue-500/20 text-white"
                                        : "bg-slate-900 border-transparent text-slate-400 hover:bg-slate-900/60"
                                    )}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{p.name}</span>
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest truncate">{p.email || 'No email registered'}</span>
                                    </div>
                                    {selected && <Check size={12} className="text-blue-500" />}
                                  </button>
                                );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Footer Action Buttons */}
                <div className="mt-8 pt-6 border-t-2 border-slate-800 flex flex-col md:flex-row gap-3 justify-end items-stretch md:items-center">
                  
                  {/* Left loader indicator */}
                  {loading && (
                    <div className="flex items-center gap-2 mr-auto text-blue-500 text-[10px] font-black uppercase tracking-widest italic animate-pulse">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processing dispatch channels...</span>
                    </div>
                  )}

                  {/* Un-broadcast Draft Save */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmit(false)}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-950 hover:bg-slate-950/70 text-slate-300 border-2 border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest transition"
                  >
                    <FileText size={14} />
                    <span>Save Draft Offline</span>
                  </button>

                  {/* Mail Deliver Broadcast */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmit(true)}
                    className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-bento"
                  >
                    <Send size={14} />
                    <span>Send by Mail</span>
                  </button>
                </div>

              </motion.div>
            </div>
          </div>
        )}

        {/* Single Message Delete Confirmation Modal */}
        {msgToDelete && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMsgToDelete(null)}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              />

              {/* Card Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-sm rounded-[2.5rem] border-2 border-red-500/20 bg-slate-900 p-6 md:p-8 text-center shadow-2xl overflow-hidden z-20"
              >
                {/* Warning icon */}
                <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 mb-6">
                  <AlertCircle size={32} />
                </div>

                <h2 className="text-xl font-black uppercase text-white tracking-tight">
                  Delete Message?
                </h2>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-2">
                  Are you sure you want to permanently delete this broadcast record?
                </p>
                
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 mt-4 text-left">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider truncate mb-1">
                    {msgToDelete.subject}
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                    {msgToDelete.body}
                  </p>
                </div>

                <div className="flex gap-3 justify-center items-center mt-6">
                  <button
                    onClick={() => setMsgToDelete(null)}
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(msgToDelete.id || '')}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-red-600/20"
                  >
                    Yes, Delete
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* All Messages Delete Confirmation Modal */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !loading && setShowDeleteAllConfirm(false)}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              />

              {/* Card Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-md rounded-[2.5rem] border-2 border-red-500/20 bg-slate-900 p-6 md:p-8 text-center shadow-2xl overflow-hidden z-20"
              >
                {/* Warning icon */}
                <div className="mx-auto h-16 w-16 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20 mb-6">
                  <Trash2 size={32} />
                </div>

                <h2 className="text-xl font-black uppercase text-white tracking-tight">
                  Delete All Messages?
                </h2>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-2 leading-relaxed">
                  Are you absolutely sure you want to permanently delete <span className="text-red-400 font-extrabold">{teamMessages.length}</span> team message broadcast logs? This action is irreversible.
                </p>

                {loading ? (
                  <div className="mt-6 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={24} className="text-red-500 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deleting all records...</span>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-center items-center mt-6">
                    <button
                      onClick={() => setShowDeleteAllConfirm(false)}
                      className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAll}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-red-600/20"
                    >
                      Yes, Clear All
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
