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
    order: {
      version: 1,
      pubkey,
      action,
      content,
    },
  };
  if (action == "new-order") {
    const k = kind.toLowerCase();
    const fiat = fiat_code.toUpperCase();
    content = {
      order: {
        kind: k,
        status: "pending",
        amount: parseInt(amount),
        fiat_code: fiat,
        fiat_amount: parseInt(fiat_amount),
        payment_method,
        premium,
        buyer_invoice,
        created_at: 0,
      },
    };
    order_message.order.content = content;
  } else if (action == "cancel") {
    order_message.order.id = id;
  }
  return order_message;
};
