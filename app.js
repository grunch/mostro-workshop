require("websocket-polyfill");
const Table = require("cli-table");
const { Command } = require("commander");
const {
  default: NDK,
  NDKEvent,
  NDKKind,
  NDKPrivateKeySigner,
  NDKNip46Signer,
  NDKRelaySet,
} = require("@nostr-dev-kit/ndk");

const MOSTRO_PUBKEY =
  "25990d8f6e55ede920c826aa219d69b1ab39cae02e489337e88e3b7ec4377c2c";
const NOSTR_REPLACEABLE_EVENT_KIND = 38383;

const ndk = new NDK({
  explicitRelayUrls: [
    "wss://nostr.wine",
    "wss://btc.klendazu.com",
    "wss://relay.damus.io",
    "wss://nos.lol",
  ],
  enableOutboxModel: true,
});

ndk.connect(6000);

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
  authors: [MOSTRO_PUBKEY],
  since,
  "#s": ["Pending"],
};

const listOrders = async () => {
  const orders = await ndk.fetchEvents(filters);
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

async function main() {
  const program = new Command();

  program
    .command("listorders")
    .description("Requests and list open orders from Mostro pubkey")
    .action(listOrders);
  program.parse(process.argv);
}

main();
