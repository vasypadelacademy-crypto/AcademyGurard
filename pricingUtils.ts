import { format } from 'date-fns';

/**
 * Finds the best pricing scheme for a given package type, session count, and effective month.
 */
export const findBestPricingScheme = (
  schemes: any[], 
  packageTypeCode: string, 
  numSessions: number, 
  effectiveMonth: string,
  anchorDate?: string // Used when effectiveMonth is 'current'
) => {
  if (!schemes || schemes.length === 0) return null;

  const normalizedCode = (packageTypeCode || '').toUpperCase().trim();
  const matchingType = (schemes || [])
    .filter(ps => (ps.packageTypeCode || '').toUpperCase().trim() === normalizedCode)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth));

  if (matchingType.length === 0) return null;

  // Resolve targetMonth
  let targetMonth = effectiveMonth;
  if (!targetMonth || targetMonth === 'current' || !targetMonth.includes('-')) {
    const anchor = (anchorDate && anchorDate.includes('-')) ? anchorDate.slice(0, 7) : format(new Date(), 'yyyy-MM');
    // For 'current', we want the latest available month that is <= anchor
    const latestAvailable = matchingType.find(ps => ps.effectiveMonth <= anchor);
    targetMonth = latestAvailable ? latestAvailable.effectiveMonth : matchingType[matchingType.length - 1].effectiveMonth;
  }

  // 1. Exact match (Month + Sessions)
  let s = matchingType.find(ps => Number(ps.numSessions) === Number(numSessions) && ps.effectiveMonth === targetMonth);
  
  // 2. Nearest previous month match for the SAME session count
  if (!s) {
    s = matchingType.find(ps => Number(ps.numSessions) === Number(numSessions) && ps.effectiveMonth <= targetMonth);
  }

  // 3. Fallback: Latest match for this type that is <= targetMonth (Any session count)
  if (!s) {
    s = matchingType.find(ps => ps.effectiveMonth <= targetMonth);
  }
  
  // 4. Any month match for the SAME session count (latest)
  if (!s) {
    s = matchingType.find(ps => Number(ps.numSessions) === Number(numSessions));
  }
  
  // 5. Absolute fallback: Latest available for this type
  if (!s) {
    s = matchingType[0];
  }

  return s;
};

/**
 * Calculates the derived base amount and total due for a package based on its sessions and pricing schemes.
 */
export const calculatePackageValues = (
  pkg: any,
  pkgSessions: any[],
  schemes: any[],
  forceSystemPricing: boolean = false,
  onlyRealized: boolean = false
) => {
  if (!pkg) return { derivedBaseAmount: 0, derivedTotalDue: 0, derivedTotalDiscount: 0, derivedTotalCost: 0 };
  
  const actualForce = forceSystemPricing || pkg.forceSystemPricing;
  const nSessions = Number(pkg.numSessions || 8);
  const effectiveMonth = pkg.effectiveMonth || pkg.createdAt?.slice(0, 7) || format(new Date(), 'yyyy-MM');
  const anchorDate = pkg.startDate;
  const pkgDiscountAmount = Number(pkg.discountAmount || 0);

  const valuatedStatuses = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'];
  
  let totalSessionsPrice = 0;
  let totalSessionsDiscount = 0;
  let totalSessionsCost = 0;
  let valuatedCount = 0;

  if (pkgSessions.length === 0) {
    const scheme = findBestPricingScheme(schemes, pkg.packageTypeCode, nSessions, effectiveMonth, anchorDate);
    totalSessionsPrice = (scheme?.sessionValue || 0) * nSessions;
  } else {
    pkgSessions.forEach((s: any) => {
      if (!valuatedStatuses.includes(s.status)) return;
      if (onlyRealized && s.status === 'Scheduled') return;
      
      valuatedCount++;
      
      const normalizedPkgCode = (pkg.packageTypeCode || '').toUpperCase().trim();
      const rawPrefix = s.sessionIndex && s.sessionIndex.includes('-') 
        ? s.sessionIndex.split('-')[0].toUpperCase().trim() 
        : '';
      const isPrefixValid = schemes.some(ps => (ps.packageTypeCode || '').toUpperCase().trim() === rawPrefix);
      const prefix = (isPrefixValid && rawPrefix) ? rawPrefix : normalizedPkgCode;

      const sessionNSessions = prefix === normalizedPkgCode ? nSessions : 1;
      const pricing = findBestPricingScheme(schemes, prefix, sessionNSessions, effectiveMonth, anchorDate);
      
      const dbVal = Number(s.value || 0);
      const val = (actualForce || dbVal === 0) ? (pricing?.sessionValue || 0) : dbVal;
      
      totalSessionsPrice += val;
      totalSessionsDiscount += Number(s.discount || 0);

      let playerCount = 1;
      if (prefix === 'G2') playerCount = 2;
      else if (prefix === 'G3') playerCount = 3;
      else if (prefix === 'G4' || prefix === 'G4+') playerCount = 4;
      
      const sCst = (Number(pricing?.sessionCost || 0)) / playerCount;
      totalSessionsCost += sCst;
    });
  }

  const derivedBaseAmount = (pkg.baseAmountOverride > 0) ? Number(pkg.baseAmountOverride) : totalSessionsPrice;
  const derivedTotalDiscount = totalSessionsDiscount + pkgDiscountAmount;
  const derivedTotalDue = Math.max(0, derivedBaseAmount - derivedTotalDiscount);
  const derivedTotalCost = totalSessionsCost;

  return { derivedBaseAmount, derivedTotalDue, derivedTotalDiscount, derivedTotalCost };
};
