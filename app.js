require("websocket-polyfill");
require("dotenv").config();

const Table = require("cli-table");
const {
  finalizeEvent,
  verifyEvent,
  getPublicKey,
} = require("nostr-tools/pure");
const { decode } = require("nostr-tools/nip19");
const { encrypt } = require("nostr-tools/nip04");
const { SimplePool } = require("nostr-tools/pool");
const { Command } = require("commander");

const { buildOrderMessage } = require("./order");

const NOSTR_REPLACEABLE_EVENT_KIND = 38383;

const pool = new SimplePool();
const { _, data } = decode(process.env.MOSTRO_NPUB);
const mostroPubkey = data;
const relays = [
  "wss://nos.lol",
  "wss://relay.damus.io",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr.mutinywallet.com",
  "wss://relay.nostr.band",
  "wss://nostr.cizmar.net",
  "wss://140.f7z.io",
  "wss://nostrrelay.com",
  "wss://relay.nostrr.de",
];

const myPrivKey = process.env.HEX_PRIVATE_KEY;
const myPubKey = getPublicKey(myPrivKey);

const objectify = (array) => {
  return array.reduce(function (p, c) {
    p[c[0]] = c[1];
    return p;
  }, {});
};

const extractOrderFromEvent = (event) => {
  // Extract values from the tags map
  const tags = objectify(event.tags);
  const id = tags.d;
  const kind = tags.k;
  const status = tags.s;
  const fiat_code = tags.f;
  const fiat_amount = Number(tags.fa);
  const amount = Number(tags.amt);
  const payment_method = tags.pm;
  const premium = Number(tags.premium);
  const created_at = event.created_at || 0;

  return {
    id,
    kind,
    status,
    fiat_code,
    fiat_amount,
    payment_method,
    premium,
    created_at,
    amount,
  };
};

const daysInSecs = 2 * 60 * 60 * 24;
const since = parseInt(Date.now() / 1000 - daysInSecs);

const filters = {
  kinds: [NOSTR_REPLACEABLE_EVENT_KIND],
  authors: [mostroPubkey],
  since,
  "#s": ["pending"],
};

const listOrders = async () => {
  const orders = await pool.querySync(relays, filters);
  const table = new Table({
    head: [
      "Buy/Sell",
      "Order Id",
      "Status",
      "Amount",
      "Fiat",
      "Fiat Amt",
      "Payment Method",
      "Premium",
      "Created",
    ],
  });

  orders.forEach((o) => {
    const order = extractOrderFromEvent(o);
    const amount = order.amount === 0 ? "Market price" : order.amount;
    const created = new Date(order.created_at * 1000).toLocaleString();
    table.push([
      order.kind,
      order.id,
      order.status,
      amount,
      order.fiat_code,
      order.fiat_amount,
      order.payment_method,
      order.premium,
      created,
    ]);
  });
  console.log(table.toString());
};

const newOrder = async (
  kind,
  status,
  amount,
  fiat_code,
  fiat_amount,
  payment_method,
  premium,
  buyer_invoice
) => {
  const order = buildOrderMessage(
    null,
    myPubKey,
    "new-order",
    kind,
    status,
    amount,
    fiat_code,
    fiat_amount,
    payment_method,
    premium,
    buyer_invoice
  );
  // private key to sign the event
  const jsonOrder = JSON.stringify(order);
  const encryptedOrder = await encrypt(myPrivKey, mostroPubkey, jsonOrder);

  let event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", mostroPubkey]],
      content: encryptedOrder,
    },
    myPrivKey
  );
  const ok = verifyEvent(event);
  if (!ok) {
    console.log("Event not verified");
    return;
  }
  await Promise.any(pool.publish(relays, event));
};

const cancel = async (id) => {
  const orderMessage = buildOrderMessage(id, myPubKey, "cancel");
  // private key to sign the event
  const jsonOrder = JSON.stringify(orderMessage);
  const encryptedOrder = await encrypt(myPrivKey, mostroPubkey, jsonOrder);

  let event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", mostroPubkey]],
      content: encryptedOrder,
    },
    myPrivKey
  );
  const ok = verifyEvent(event);
  if (!ok) {
    console.log("Event not verified");
    return;
  }
  await Promise.any(pool.publish(relays, event));
};

async function main() {
  const program = new Command();

  program
    .command("listorders")
    .description("Requests and list open orders from Mostro pubkey")
    .action(listOrders);

  program
    .command("neworder")
    .argument("<kind>", "Buy or Sell")
    .argument("<amount>", "Amount of BTC")
    .argument("<fiat_code>", "Fiat currency code")
    .argument("<fiat_amount>", "Fiat amount")
    .argument("<payment_method>", "Payment method")
    .argument("[premium]", "Premium", 0)
    .argument("[buyer_invoice]", "Buyer invoice")
    .description("Create a new buy/sell order on Mostro")
    .action(
      (
        kind,
        amount,
        fiat_code,
        fiat_amount,
        payment_method,
        premium,
        buyer_invoice
      ) => {
        const order = newOrder(
          kind,
          amount,
          fiat_code,
          fiat_amount,
          payment_method,
          premium,
          buyer_invoice
        );
        console.log(order);
      }
    );

  program
    .command("cancel")
    .argument("<id>", "Order Id to cancel")
    .description("Cancel a pending order")
    .action((id) => {
      const c = cancel(id);
      console.log(c);
    });
  program.parse(process.argv);
}

main();
