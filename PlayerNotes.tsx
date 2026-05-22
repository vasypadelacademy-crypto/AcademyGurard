import React, { useState } from 'react';
import { Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { Player, PlayerNote } from '../types';
import { useData } from '../lib/DataContext';
import { format } from 'date-fns';

export default function PlayerNotes({ player }: { player: Player }) {
  const { updateMasterData } = useData();
  const [note, setNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = async () => {
    if (!note.trim()) return;
    
    const now = new Date();
    const newNote: PlayerNote = {
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'HH:mm'),
      note: note.trim()
    };
    
    const updatedNotes = [...(player.playerNotes || []), newNote];
    await updateMasterData('players', player.id!, { playerNotes: updatedNotes });
    setNote('');
    setIsAdding(false);
  };

  const handleDeleteNote = async (index: number) => {
    const updatedNotes = (player.playerNotes || []).filter((_, i) => i !== index);
    await updateMasterData('players', player.id!, { playerNotes: updatedNotes });
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-bento">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-black uppercase tracking-widest text-lg">Athlete Notes</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold uppercase text-xs tracking-widest"
        >
          <Plus size={16} /> {isAdding ? 'Cancel' : 'Add Note'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 space-y-2">
          <textarea
            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white text-sm"
            placeholder="Type your notes here..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button 
            onClick={handleAddNote}
            className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-xs uppercase"
          >
            Save Note
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs uppercase tracking-widest text-slate-400 border-collapse border border-slate-800">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="py-2 px-3 text-[10px] border-r border-slate-800">Date</th>
              <th className="py-2 px-3 text-[10px] border-r border-slate-800">Time</th>
              <th className="py-2 px-3 text-[10px] w-full border-r border-slate-800">Note</th>
              <th className="py-2 px-3 text-[10px]"></th>
            </tr>
          </thead>
          <tbody>
            {(player.playerNotes || []).map((n, idx) => (
              <tr key={idx} className="border-b border-slate-800/50">
                <td className="py-3 px-3 text-white font-bold whitespace-nowrap border-r border-slate-800">{n.date}</td>
                <td className="py-3 px-3 text-white font-bold whitespace-nowrap border-r border-slate-800">{n.time}</td>
                <td className="py-3 px-3 text-white border-r border-slate-800">{n.note}</td>
                <td className="py-3 px-3 flex items-center justify-center">
                  <button onClick={() => handleDeleteNote(idx)} className="text-red-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
