type TEquivalence = {
    amount: number;
    currency: string;
};

interface Statistics {
    amounts: { [key: string]: number[] },
    dates: string[]
}

interface ChartData extends Statistics {
    chatId?: number;
    messageId?: number;
}
