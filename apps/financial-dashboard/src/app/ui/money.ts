import { formatMoney, sumMoneyByCurrency, type Money } from "@hewa/marketplace-types";

/**
 * Totals, rendered for a summary bar or a table footer.
 *
 * A list of money may hold more than one currency — an ISP prices its retail customers
 * in KES while the marketplace bills in USD, and a ledger page can carry both — and
 * `sumMoney` refuses to add across currencies rather than convert, because a conversion
 * needs a rate and an unnamed rate is an invented one.
 *
 * So a total is a list. When it holds one currency this is `formatMoney` of that
 * currency; when it holds more, each is drawn with its own symbol and the reader can
 * see that a column is not one number. The alternative — picking the first currency
 * and quietly scaling the rest into it — is a figure that agrees with every row in the
 * column and with nothing at all on the total.
 *
 * `nothing` rather than `0.00 USD` for an empty list, because a section with no rows
 * has not totalled zero of anything: it has nothing to add up, and a zero is a claim
 * about a month in which no money moved.
 */
export function moneyTotals(values: readonly Money[]): string {
  const totals = sumMoneyByCurrency(values);

  if (totals.length === 0) {
    return "nothing";
  }

  return totals.map((total) => formatMoney(total)).join(", ");
}
