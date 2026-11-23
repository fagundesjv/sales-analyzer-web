export const cyclePresets = {
  loja: { label: "Loja", days: [1, 3, 7] },
  viagem: { label: "Viagens", days: [2, 5, 10] },
  servicos_agenda: { label: "Serviços com agenda", days: [1, 3] },
};

export function validDays(days) {
  return (
    days.length >= 1 &&
    days.length <= 6 &&
    days.every(
      (day, i) =>
        Number.isInteger(day) &&
        day >= 1 &&
        day <= 90 &&
        (!i || day > days[i - 1]),
    )
  );
}

export function cycleDates(start, days) {
  if (!start || !validDays(days)) return [];
  return days.map((offset) => {
    const date = new Date(start + "T12:00:00");
    date.setDate(date.getDate() + offset);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  });
}

export const followupAfterOutcome = [
  {
    id: "postSale",
    label: "Pós-venda",
    outcome: "won",
    days: 7,
    min: 1,
    max: 60,
  },
  {
    id: "repurchase",
    label: "Recompra",
    outcome: "won",
    days: 90,
    min: 15,
    max: 365,
  },
  {
    id: "reactivation",
    label: "Reativação",
    outcome: "lost",
    days: 60,
    min: 60,
    max: 90,
  },
];
