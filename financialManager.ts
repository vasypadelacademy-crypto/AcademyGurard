import { Reminder, Package, Session, PricingScheme } from '../types';
import { formatCurrency } from './utils';
import { calculatePackageValues } from './pricingUtils';

export const manageFinancialAlarm = async (
  playerId: string,
  playerName: string,
  allPackages: Package[],
  allSessions: Session[],
  reminders: Reminder[],
  addMasterData: (c: string, d: any) => Promise<any>,
  updateMasterData: (c: string, id: string, d: any) => Promise<void>,
  deleteMasterData: (c: string, id: string) => Promise<void>,
  allPayments?: any[],
  pricingSchemes?: PricingScheme[],
  overrideTotalDue?: number
) => {
  // Use overrideTotalDue if provided, otherwise calculate derived values
  let totalDue = 0;
  let playerPackages = allPackages.filter(p => p.playerId === playerId);
  
  if (overrideTotalDue !== undefined) {
    totalDue = overrideTotalDue;
  } else {
    // Calculate total due for this player, using real payments and derived totals if possible
    totalDue = playerPackages.reduce((sum, p) => {
      const pkgPayments = (allPayments || []).filter(pay => String(pay.packageId) === String(p.id));
      const realPaid = pkgPayments.length > 0 
        ? pkgPayments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0)
        : Number(p.paidAmount || 0);
      
      let pkgDue = Number(p.totalDue || 0);
      
      // If manually marked as Paid or Free, debt is 0
      if (p.status === 'Paid' || p.status === 'Free') {
          return sum;
      }
      
      return sum + Math.max(0, pkgDue - realPaid);
    }, 0);
  }
  
  const financialReminders = reminders.filter(r => r.playerId === playerId && r.category === 'Financial');
  
  // Find info for the alarm message - pick the latest package with actual debt
  const playerPackagesSorted = playerPackages.sort((a, b) => {
      const dateA = a.startDate || a.createdAt || '';
      const dateB = b.startDate || b.createdAt || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.packageTypeCode || '').localeCompare(b.packageTypeCode || '');
  });

  const packagesWithDebt = playerPackagesSorted.filter(p => {
      const pkgPayments = (allPayments || []).filter(pay => String(pay.packageId) === String(p.id));
      const realPaid = pkgPayments.length > 0 
        ? pkgPayments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0)
        : Number(p.paidAmount || 0);

      let pkgDue = Number(p.totalDue || 0);
      if (p.status === 'Paid' || p.status === 'Free') return false;
      return (pkgDue - realPaid) > 0.01;
  });

  const oldestUnpaidPkg = packagesWithDebt[0];
  let breakdownStr = '';
  packagesWithDebt.forEach(pkg => {
     const pkgIndex = playerPackagesSorted.findIndex(p => p.id === pkg.id);
     const pkgLabel = pkgIndex >= 0 ? `M${pkgIndex + 1}` : '';
     const pkgDue = Number(pkg.totalDue || 0);
     const pkgPayments = (allPayments || []).filter(p => p.packageId === pkg.id);
     const realPaid = pkgPayments.length > 0 ? pkgPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0) : Number(pkg.paidAmount || 0);
     const pending = Math.max(0, pkgDue - realPaid);
     
     if (pending > 0.01) {
         breakdownStr += `${pkgLabel} ${formatCurrency(pending)} EGP, `;
     }
  });

  if (breakdownStr) {
     breakdownStr = breakdownStr.slice(0, -2) + '. ';
  }

  if (totalDue > 0.01) {
     const msg = `${playerName}: FINANCIAL ALARM. ${breakdownStr}TOTAL DUE: ${formatCurrency(totalDue)} EGP.`;
     const existing = financialReminders[0];
     const reminderData = {
         playerId: playerId,
         category: 'Financial',
         message: msg,
         status: 'Unread',
         expectingDate: oldestUnpaidPkg ? (oldestUnpaidPkg.startDate || oldestUnpaidPkg.createdAt || null) : null
     };

     if (existing) {
       // Only update if message changed to avoid unnecessary writes
       if (existing.message !== msg || existing.expectingDate !== reminderData.expectingDate) {
          await updateMasterData('reminders', existing.id!, reminderData);
       }
       // Clean up any potential duplicates
       for (let i = 1; i < financialReminders.length; i++) {
         await deleteMasterData('reminders', financialReminders[i].id!);
       }
     } else {
       await addMasterData('reminders', reminderData);
     }
  } else {
    // If no pending, delete all financial alarms
    for (const r of financialReminders) {
        await deleteMasterData('reminders', r.id!);
    }
  }
};
