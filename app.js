require("websocket-polyfill");
require("dotenv").config();

const Table = require("cli-table");
const {
  generateSecretKey,
  finalizeEvent,
  verifyEvent,
  getPublicKey,
} = require("nostr-tools/pure");
const { decode } = require("nostr-tools/nip19");
const { encrypt } = require("nostr-tools/nip04");
const { SimplePool } = require("nostr-tools/pool");
const { Relay } = require("nostr-tools/relay");
const { bytesToHex, hexToBytes } = require("@noble/hashes/utils");
const { Command } = require("commander");

const { buildOrderMessage } = require("./order");

const NOSTR_REPLACEABLE_EVENT_KIND = 38383;

const pool = new SimplePool();
const { _, data } = decode(process.env.MOSTRO_NPUB);
const mostro_pubkey = data;
const relays = [
  "wss://nostr.wine",
  "wss://btc.klendazu.com",
  "wss://relay.damus.io",
  "wss://nos.lol",
];

const myPrivKey = generateSecretKey();
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
  authors: [mostro_pubkey],
  since,
  "#s": ["Pending"],
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
    myPubKey,
    "NewOrder",
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
  const sk = bytesToHex(myPrivKey);
  const jsonOrder = JSON.stringify(order);
  const encryptedOrder = await encrypt(sk, mostro_pubkey, jsonOrder);

  let event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", mostro_pubkey]],
      content: encryptedOrder,
    },
    sk
  );
  let isGood = verifyEvent(event);
  // const x = await Promise.any(pool.publish(relays, event));
  const relay = await Relay.connect("wss://relay.damus.io");
  await relay.publish(event);
  relay.close();
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
        console.log(
          kind,
          amount,
          fiat_code,
          fiat_amount,
          payment_method,
          premium,
          buyer_invoice
        );
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

  program.parse(process.argv);
}

main();
