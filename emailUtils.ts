import { formatCurrency, formatTimeAMPM, getSortableDate, toTitleCase } from './utils';
import { format } from 'date-fns';

export function generateEmailHtml(
  player: any,
  activePackage: any,
  currentPackageSessions: any[],
  locations: any[],
  tableSessions?: any[],
  derivedTotalDue?: number,
  realPaidAmount?: number,
  activePkgLabel?: string,
  payments?: any[],
  sessionIndexMap?: Map<string, string>,
  daysDue?: number,
  oldDue?: number,
  groups?: any[]
) {
  const pkgLabel = activePkgLabel || (activePackage ? (activePackage.packageTypeCode || 'Package') : 'Package');
  const playerName = toTitleCase(player?.name || '');
  
  const sessionsToDisplay = tableSessions || currentPackageSessions;
  const sortedSessions = [...sessionsToDisplay].sort((a: any, b: any) => {
    const dateComp = getSortableDate(a.date).localeCompare(getSortableDate(b.date));
    if (dateComp !== 0) return dateComp;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  const futureSessions = sortedSessions.filter((s: any) => !s.status || s.status === 'Scheduled' || s.status === 'Pending');
  const startDate = futureSessions.length > 0 ? formatDate(futureSessions[0].date) : (activePackage?.startDate ? formatDate(activePackage.startDate) : 'TBD');

  const targetSessions = Number(activePackage?.numSessions || 0);
  
  const due = derivedTotalDue !== undefined ? derivedTotalDue : (activePackage?.totalDue || 0);
  const paid = realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0);
  const pendingBalance = Math.max(0, due - paid);

  const attendedCount = currentPackageSessions.filter((s: any) => 
    s.status === 'Attended' || 
    s.status === 'Compensated' || 
    s.status === 'Attended Comp. Session'
  ).length;

  const absentCount = currentPackageSessions.filter((s: any) => s.status === 'Absent').length;
  const remainingCount = currentPackageSessions.filter((s: any) => s.status === 'Scheduled').length;

  const performancePercent = targetSessions > 0 ? Math.round((attendedCount / targetSessions) * 100) : 0;
  
  const remainingText = `${remainingCount} ${remainingCount === 1 ? 'session' : 'sessions'}`;
  const absentText = `${absentCount} ${absentCount === 1 ? 'session' : 'sessions'}`;

  const pastDue = oldDue || 0;
  const grandTotal = pendingBalance + pastDue;

  let htmlBody = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
      <p>Hello C. ${playerName},</p>
      <p>Here is your upcoming schedule and summary for your Package (${pkgLabel}):</p>
      
      <h3 style="margin-top: 24px; font-weight: bold;"><span style="background-color: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px;">SESSION SCHEDULE:</span></h3>
      <table style="width: auto; border-collapse: collapse; text-align: left; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Group</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Session#</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Date</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Time</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Location</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">GPS</th>
            <th style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">Status</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  sortedSessions.forEach((s: any, i: number) => {
     const loc = locations.find((l: any) => l.id === s.locationId);
     const locName = loc?.name || 'Al-Nakhil';
     const gpsLink = loc?.gps || '';
     
     // Correcting session# logic to align with Schedule view requirements (PVT-1, PVT-2 etc)
     const sessionLabel = sessionIndexMap?.get(String(s.id)) || `${(activePackage?.packageTypeCode || activePkgLabel || 'SES').toUpperCase()}-${i + 1}`;
     
     // Resolve group code
     const sessionGroupCode = (() => {
       const group = groups ? (groups.find((g: any) => String(g.id) === String(s.groupId || player?.groupId))) : null;
       return group ? (group.code || group.name) : '—';
     })();

     htmlBody += `
          <tr>
            <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: normal; white-space: nowrap;">${sessionGroupCode}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">${sessionLabel}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">${formatDate(s.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">${formatTimeAMPM(s.startTime)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">${locName}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">
              ${gpsLink ? `
                <a href="${gpsLink}" target="_blank" style="text-decoration: none;">
                  <img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" width="20" height="20" alt="Map" style="display: block; margin: 0 auto; border: 0;" />
                </a>
              ` : '---'}
            </td>
            <td style="padding: 8px; border: 1px solid #dee2e6; white-space: nowrap;">${s.status || 'Pending'}</td>
          </tr>
     `;
  });
  htmlBody += `
        </tbody>
      </table>

      <h3 style="margin-top: 24px; font-weight: bold;"><span style="background-color: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px;">SUMMARY:</span></h3>
      <div style="margin-top: 10px;">
        <div style="margin-bottom: 4px;"><strong>Package Type:</strong> ${pkgLabel}</div>
        <div style="margin-bottom: 4px;"><strong>Due Date:</strong> ${startDate}</div>
        <div style="margin-bottom: 4px;"><strong>Total Sessions:</strong> ${targetSessions}</div>
        <div style="margin-bottom: 4px;"><strong>Attended previous sessions:</strong> ${attendedCount}/${targetSessions}</div>
        <div style="margin-bottom: 4px;"><strong>Remaining session(s):</strong> ${remainingCount} sessions</div>
        <div style="margin-bottom: 4px;"><strong>Absent:</strong> ${absentText}</div>
        <div style="margin-bottom: 4px;"><strong>Attendance performance:</strong> ${performancePercent}%</div>
      </div>

      <h3 style="margin-top: 24px; font-weight: bold;"><span style="background-color: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px;">PAYMENT DETAILS:</span></h3>
      <div style="margin-top: 10px;">
        <div style="margin-bottom: 4px;">Old due: ${formatCurrency(pastDue)} EGP</div>
        <div style="margin-bottom: 4px;">Current package due: ${formatCurrency(pendingBalance)} EGP</div>
        <div style="margin-bottom: 4px;">Total Due: <span style="color: red;">${formatCurrency(grandTotal)} EGP</span></div>
      </div>
      
      <p style="font-size: 13px; font-weight: normal; color: #000000; margin-top: 12px;">Payment to be kindly settled in cash or via InstaPay (01222200548 bank acc)</p>
      
      ${daysDue ? `<p style="color: #ef4444; font-weight: bold; margin-bottom: 12px;">Notice: This balance is currently ${daysDue} days overdue.</p>` : ''}
      ${payments && payments.length > 0 ? `
        <h4 style="margin-top: 16px; font-weight: bold;">Recent Payments:</h4>
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 8px; border: 1px solid #dee2e6;">Date</th>
              <th style="padding: 8px; border: 1px solid #dee2e6;">Amount</th>
              <th style="padding: 8px; border: 1px solid #dee2e6;">Method</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${p.date ? new Date(p.date).toLocaleDateString('en-GB') : '-'}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${formatCurrency(p.amount)} EGP</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${p.method || 'Bank'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <p style="margin-top: 24px; color: red;">
        <em>24-hour notice is required for all cancellations; otherwise, the session fee applies (terms and conditions attached).</em>
      </p>
      
      <p style="margin-top: 24px;">
        Best,<br/>
        <span style="font-weight: bold; font-style: italic;">Vas-y Padel Academy</span>
      </p>
    </div>
  `;
  return htmlBody;
}

export function generateEmailBody(
  player: any,
  activePackage: any,
  currentPackageSessions: any[],
  locations: any[],
  tableSessions?: any[],
  derivedTotalDue?: number,
  realPaidAmount?: number,
  activePkgLabel?: string,
  payments?: any[],
  sessionIndexMap?: Map<string, string>,
  daysDue?: number,
  oldDue?: number,
  groups?: any[]
) {
  const pkgLabel = activePkgLabel || (activePackage ? (activePackage.packageTypeCode || 'Package') : 'Package');
  const playerName = toTitleCase(player?.name || '');
  
  const sessionsToDisplay = tableSessions || currentPackageSessions;
  const sortedSessions = [...sessionsToDisplay].sort((a: any, b: any) => {
    const dateComp = getSortableDate(a.date).localeCompare(getSortableDate(b.date));
    if (dateComp !== 0) return dateComp;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  const futureSessions = sortedSessions.filter((s: any) => !s.status || s.status === 'Scheduled' || s.status === 'Pending');
  const startDate = futureSessions.length > 0 ? formatDate(futureSessions[0].date) : (activePackage?.startDate ? formatDate(activePackage.startDate) : 'TBD');

  const targetSessions = Number(activePackage?.numSessions || 0);
  
  const due = derivedTotalDue !== undefined ? derivedTotalDue : (activePackage?.totalDue || 0);
  const paid = realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0);
  const pendingBalance = Math.max(0, due - paid);

  const attendedCount = currentPackageSessions.filter((s: any) => 
    s.status === 'Attended' || 
    s.status === 'Compensated' || 
    s.status === 'Attended Comp. Session'
  ).length;

  const absentCount = currentPackageSessions.filter((s: any) => s.status === 'Absent').length;
  const remainingCount = currentPackageSessions.filter((s: any) => s.status === 'Scheduled').length;

  const performancePercent = targetSessions > 0 ? Math.round((attendedCount / targetSessions) * 100) : 0;
  
  const remainingText = `${remainingCount} ${remainingCount === 1 ? 'session' : 'sessions'}`;
  const absentText = `${absentCount} ${absentCount === 1 ? 'session' : 'sessions'}`;

  let defaultBody = `Hello C. ${playerName},\n\nHere is your upcoming schedule and summary for your Package (${pkgLabel}):\n\n`;
  
  defaultBody += `SESSION SCHEDULE:\n------------------------------------------------------------------------------------------------\n`;
  defaultBody += `| Group      | Session# | Date       | Time     | Location            | Status    |\n`;
  defaultBody += `------------------------------------------------------------------------------------------------\n`;
  sortedSessions.forEach((s: any, i: number) => {
     const locName = locations.find((l: any) => l.id === s.locationId)?.name || 'Al-Nakhil';
     
     // Correcting session# logic to align with Schedule view requirements (PVT-1, PVT-2 etc)
     const sessionLabel = sessionIndexMap?.get(String(s.id)) || `${(activePackage?.packageTypeCode || activePkgLabel || 'SES').toUpperCase()}-${i + 1}`;
     
     // Resolve group code
     const sessionGroupCode = (() => {
       const group = groups ? (groups.find((g: any) => String(g.id) === String(s.groupId || player?.groupId))) : null;
       return group ? (group.code || group.name) : '—';
     })();

     const sGrp = String(sessionGroupCode).padEnd(10);
     const sIdx = String(sessionLabel).padEnd(8);
     const sDate = formatDate(s.date).padEnd(10);
     const sTime = formatTimeAMPM(s.startTime).padEnd(8);
     const sLoc = locName.padEnd(19);
     const sStatus = (s.status || 'Pending').padEnd(9);
     defaultBody += `| ${sGrp} | ${sIdx} | ${sDate} | ${sTime} | ${sLoc} | ${sStatus} |\n`;
  });
  defaultBody += `------------------------------------------------------------------------------------------------\n`;
  
  defaultBody += `\nSUMMARY:\n----------------------------------------\n`;
  defaultBody += `Package Type: ${pkgLabel}\n`;
  defaultBody += `Due Date: ${startDate}\n`;
  defaultBody += `Total Sessions: ${targetSessions}\n`;
  defaultBody += `Attended previous sessions: ${attendedCount}/${targetSessions}\n`;
  defaultBody += `Remaining session(s): ${remainingCount} sessions\n`;
  defaultBody += `Absent: ${absentText}\n`;
  defaultBody += `Attendance performance: ${performancePercent}%\n`;
  
  const pastDue = oldDue || 0;
  const grandTotal = pendingBalance + pastDue;

  defaultBody += `\nPAYMENT DETAILS:\n----------------------------------------\n`;
  defaultBody += `Old due: ${formatCurrency(pastDue)} EGP\n`;
  defaultBody += `Current package due: ${formatCurrency(pendingBalance)} EGP\n`;
  defaultBody += `Total Due: ${formatCurrency(grandTotal)} EGP\n`;
  defaultBody += `----------------------------------------\n`;
  
  defaultBody += `Payment to be kindly settled in cash or via InstaPay (01222200548 bank acc)\n\n`;
  
  if (daysDue) {
    defaultBody += `NOTICE: This balance is ${daysDue} days overdue.\n\n`;
  }
  
  if (payments && payments.length > 0) {
    defaultBody += `Recent Payments:\n`;
    payments.forEach(p => {
       const pDate = p.date ? new Date(p.date).toLocaleDateString('en-GB') : '-';
       const pAmount = p.amount;
       const pMethod = p.method || 'Bank';
       defaultBody += `${pDate}, ${formatCurrency(pAmount)} EGP, ${pMethod}.\n`;
    });
    defaultBody += `\n`;
  }
  
  defaultBody += `24-hour notice is required for all cancellations; otherwise, the session fee applies (terms and conditions attached).\n\n`;
  defaultBody += `Best,\nVas-y Padel Academy`;
  
  return defaultBody;
}

function formatDateAlt(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.toLocaleDateString('en-GB')} ${format(d, 'EEE')}`;
}

export function generateFinancialEmailHtml(
  player: any,
  totalDueAmount: number,
  packagesBreakdown: { label: string, due: number, startDate: string }[]
) {
  const playerName = toTitleCase(player?.name || '');

  let htmlBody = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
      <p>Dear C. ${playerName}</p>
      
      <p>We would like to inform you that your account shows an outstanding balance of <span style="font-weight: bold; color: #ef4444;">${formatCurrency(totalDueAmount)}</span>.</p>
      
      <p style="font-weight: bold; color: #000; margin-top: 24px; margin-bottom: 8px;">Due amount details</p>
      <table style="width: auto; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #ddd; font-size: 13px;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: left; font-weight: bold;">PKG ID</th>
            <th style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: center; font-weight: bold;">Start package date</th>
            <th style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: right; font-weight: bold;">Due value (EGP)</th>
          </tr>
        </thead>
        <tbody>
          ${packagesBreakdown.map(pkg => `
            <tr>
              <td style="border: 1px solid #dee2e6; padding: 4px 12px;">${pkg.label}</td>
              <td style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: center;">${pkg.startDate ? formatDateAlt(pkg.startDate) : '-'}</td>
              <td style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: right;">${formatCurrency(pkg.due)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background-color: #fdfdfe;">
            <td colspan="2" style="border: 1px solid #dee2e6; padding: 4px 12px;">Total Due Amount</td>
            <td style="border: 1px solid #dee2e6; padding: 4px 12px; text-align: right; color: #ef4444;">${formatCurrency(totalDueAmount)}</td>
          </tr>
        </tbody>
      </table>

      <p style="font-weight: normal; color: #000000; font-size: 14px; margin-top: 24px;">Payment to be kindly settled in cash or via InstaPay (01222200548 bank acc)</p>
      
      <p style="margin-top: 16px;">If payment has already been made, please disregard this notice. For any questions or if you need assistance, please let us know.</p>
      
      <p style="margin-top: 16px;">We appreciate your cooperation; it's always a pleasure to offer the best service for you.</p>

      <p style="margin-top: 24px;">
        Sincerely,<br/>
        <span style="font-weight: bold; font-style: italic;">Vas-y Padel Academy</span>
      </p>
    </div>
  `;
  return htmlBody;
}

export function generateFinancialEmailBody(
  player: any,
  totalDueAmount: number,
  packagesBreakdown: { label: string, due: number, startDate: string }[]
) {
  const playerName = toTitleCase(player?.name || '');

  let defaultBody = `Dear C. ${playerName}\n\n`;
  defaultBody += `We would like to inform you that your account shows an outstanding balance of ${formatCurrency(totalDueAmount)}.\n\n`;
  
  defaultBody += `PAYMENT DETAILS:\n`;
  defaultBody += `------------------------------------------------------------\n`;
  defaultBody += `| PKG ID |  Start Date  | Due Value (EGP) |\n`;
  defaultBody += `------------------------------------------------------------\n`;
  packagesBreakdown.forEach(pkg => {
    const label = pkg.label.padEnd(6);
    const date = (pkg.startDate ? formatDateAlt(pkg.startDate) : '-').padStart(12).padEnd(12);
    const due = `${formatCurrency(pkg.due)}`.padStart(15);
    defaultBody += `| ${label} | ${date} | ${due} |\n`;
  });
  defaultBody += `------------------------------------------------------------\n`;
  defaultBody += `Total Due Amount: ${formatCurrency(totalDueAmount)} EGP\n`;
  defaultBody += `------------------------------------------------------------\n\n`;

  defaultBody += `Payment to be kindly settled in cash or via InstaPay (01222200548 bank acc)\n\n`;
  defaultBody += `If payment has already been made, please disregard this notice. For any questions or if you need assistance, please let us know.\n\n`;
  defaultBody += `We appreciate your cooperation; it's always a pleasure to offer the best service for you.\n\n`;
  
  defaultBody += `Sincerely,\nVas-y Padel Academy`;
  
  return defaultBody;
}

export function generatePaymentConfirmationEmailHtml(
  player: any,
  pkgLabel: string,
  paymentDate: string,
  amount: number,
  method: string
) {
  const formattedDate = paymentDate ? new Date(paymentDate).toLocaleDateString('en-GB') : '-';
  const playerName = toTitleCase(player?.name || '');
  return `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
      <p>Dear C. ${playerName}</p>
      <p>Thank you for your payment for Pkg ID ${pkgLabel}. Payment done on ${formattedDate} amounting to ${amount} LE, in ${method}.</p>
      <p>Do not hesitate to contact us if you have any questions.</p>
      <p>
        Best regards,<br/>
        <span style="font-weight: bold; font-style: italic;">Vas-y Padel Academy</span>
      </p>
    </div>
  `;
}

export function generatePaymentConfirmationEmailBody(
  player: any,
  pkgLabel: string,
  paymentDate: string,
  amount: number,
  method: string
) {
  const formattedDate = paymentDate ? new Date(paymentDate).toLocaleDateString('en-GB') : '-';
  const playerName = toTitleCase(player?.name || '');
  return `Dear C. ${playerName}\n\nThank you for your payment for Pkg ID ${pkgLabel}. Payment done on ${formattedDate} amounting to ${amount} LE, in ${method}.\n\nDo not hesitate to contact us if you have any questions.\n\nBest regards,\nVas-y Padel Academy`;
}
