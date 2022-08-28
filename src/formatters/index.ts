const formatEmoji = (newAmount: number, oldAmount: number) => {
    return newAmount > oldAmount ? '🔼' :
           newAmount < oldAmount ? '🔽' : '⏹';
}

const formatIncrease = (newAmount: number, oldAmount: number) => {
    const increase = newAmount - oldAmount;
    if (increase === 0) return 'без изменений';
    return `${increase > 0 ? '+' : ''}${increase.toFixed(2)}`;
}

export const formatSummaryByCurrency = (summary: any, summaryOld?: any) => {
    let text = '';
    for (const currency of Object.keys(summary)) {
        const amount = summary[currency];
        if (summaryOld && summaryOld[currency]) {
            const oldAmount = summaryOld[currency];
            const increase = formatIncrease(amount, oldAmount);
            const emoji = formatEmoji(amount, oldAmount);
            text += `${emoji} Сумма в ${currency}: ${amount.toFixed(2)} (${oldAmount.toFixed(2)}, ${increase})\n`;
        } else {
            text += `Сумма в ${currency}: ${amount.toFixed(2)}\n`;
        }
    }
    return text;
}

export const formatEquivalence = (equivalence: TEquivalence, equivalenceOld?: TEquivalence) => {
    const currency = equivalence.currency;
    const amount = equivalence.amount;
    if (equivalenceOld) {
        const oldAmount = equivalenceOld.amount;
        const increase = formatIncrease(amount, oldAmount);
        const emoji = formatEmoji(amount, oldAmount);
        return `${emoji} Эквивалент в переводе на ${currency}: ${amount.toFixed(2)} (${oldAmount.toFixed(2)}, ${increase})`;
    }
    return `Эквивалент в переводе на ${currency}: ${amount.toFixed(2)}`;
}
