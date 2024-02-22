exports.buildOrderMessage = (
  id,
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
  let content = null;
  let order_message = {
    Order: {
      version: 1,
      pubkey,
      action,
      content,
    },
  };
  if (action == "NewOrder") {
    const k = kind.charAt(0).toUpperCase() + kind.slice(1);
    const fiat = fiat_code.toUpperCase();
    content = {
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
    };
    order_message.Order.content = content;
  } else if (action == "Cancel") {
    order_message.Order.id = id;
  }
  return order_message;
};
