exports.buildOrderMessage = (
  pubkey,
  action,
  kind,
  amount,
  fiat_code,
  fiat_amount,
  payment_method,
  premium,
  buyer_invoice
) => {
  const k = kind.charAt(0).toUpperCase() + kind.slice(1);
  const fiat = fiat_code.toUpperCase();
  return {
    Order: {
      version: 1,
      pubkey,
      action,
      content: {
        Order: {
          kind: k,
          status: "Pending",
          amount: parseInt(amount),
          fiat_code: fiat,
          fiat_amount: parseInt(fiat_amount),
          payment_method,
          premium,
          buyer_invoice,
          created_at: 0,
        },
      },
    },
  };
};
