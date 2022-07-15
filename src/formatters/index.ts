import { TEquivalence } from "../types/bot";

const formatEmoji = (newAmount: number, oldAmount: number) => {
    return newAmount > oldAmount ? '🔼' :
           newAmount < oldAmount ? '🔽' : '⏹';
}

const calculateIncrease = (newAmount: number, oldAmount: number) => {
    return (newAmount - oldAmount) / oldAmount * 100;
}

export const formatSummaryByCurrency = (summary: any, summaryOld?: any) => {
    let text = '';
    for (const currency of Object.keys(summary)) {
        const amount = summary[currency];
        if (summaryOld && summaryOld[currency]) {
            const oldAmount = summaryOld[currency];
            const percentage = calculateIncrease(amount, oldAmount);
            const emoji = formatEmoji(amount, oldAmount);
            text += `${emoji} Сумма в ${currency}: ${amount.toFixed(2)} (${oldAmount.toFixed(2)}, ${percentage.toFixed(2)}%)\n`;
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
        const percentage = calculateIncrease(amount, oldAmount);
        const emoji = formatEmoji(amount, oldAmount);
        return `${emoji} Эквивалент в переводе на ${currency}: ${amount.toFixed(2)} (${oldAmount.toFixed(2)}, ${percentage.toFixed(2)}%)`;
    }
    return `Эквивалент в переводе на ${currency}: ${amount.toFixed(2)}`;
}
