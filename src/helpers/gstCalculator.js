/**
 * Calculates GST based on customer state vs branch state.
 * If states match -> Intra-state (CGST 9% + SGST 9% for 18% GST).
 * If states differ -> Inter-state (IGST 18%).
 */
export const calculateGST = (taxableAmount, gstPct, customerState, branchState) => {
  const isIntraState = String(customerState || '').trim().toLowerCase() === String(branchState || '').trim().toLowerCase();
  const totalTax = (taxableAmount * gstPct) / 100;

  if (isIntraState) {
    return {
      cgst: Math.round((totalTax / 2) * 100) / 100,
      sgst: Math.round((totalTax / 2) * 100) / 100,
      igst: 0,
      totalTax: Math.round(totalTax * 100) / 100,
      type: 'INTRA_STATE'
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(totalTax * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      type: 'INTER_STATE'
    };
  }
};

