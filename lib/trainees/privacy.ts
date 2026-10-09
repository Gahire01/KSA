/**
 * A trainer may see who is on their course, never what anyone owes or paid. This is
 * enforced here, in the API response, not just by hiding columns in the UI: the money
 * fields are removed from the row before it leaves the server.
 */
export function withoutMoney<T extends { amountPaidRwf?: number; paymentStatus?: string; course?: { priceRwf?: number } | null }>(
  trainee: T,
): Omit<T, "amountPaidRwf" | "paymentStatus"> {
  const { amountPaidRwf: _paid, paymentStatus: _status, ...rest } = trainee;
  void _paid;
  void _status;
  if (rest.course && typeof rest.course === "object") {
    const { priceRwf: _price, ...course } = rest.course;
    void _price;
    return { ...rest, course } as Omit<T, "amountPaidRwf" | "paymentStatus">;
  }
  return rest;
}
