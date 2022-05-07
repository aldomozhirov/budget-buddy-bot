export const formatSummaryByCurrency = (summary: any) => {
    let text = '';
    for (const currency of Object.keys(summary)) {
        text += `Сумма в ${currency}: ${summary[currency].toFixed(2)}\n`;
    }
    return text;
}

export const formatEquivalence = (equivalence: TEquivalence) => {
    const formattedAmount = equivalence.amount.toFixed(2);
    return `Эквивалент в переводе на ${equivalence.currency}: ${formattedAmount}`;
}
